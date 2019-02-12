const clc = require('cli-color')
import * as msgpack from 'notepack.io'

//region shard indexing
import * as xxhash from 'xxhash'

/**
 * Интерфейс отвечающий за разбивку редисов по хешу,
 * именно через него мы получаем доступ к нужным клиентам
 */
class HashPartitoning{
    //Список подключений к редису
    private readonly servers:RedisClient[] = []

    constructor(opts: ClientOpts[]){
        opts.forEach(o=> this.servers.push(getRedis(o)))
    }

    //Получить клиент по ключу
    serverOf(key:string):RedisClient{
        return this.servers[this.indexOf(key)]
    }

    //Получить индекс клиента по ключу
    indexOf(key:string|number):number{
        if (typeof key == 'number') key = key.toString()
        return Math.floor(
            xxhash.hash64(
                Buffer.from(key, 'utf8'), 0x2B0352DF, 'buffer'
            ).readUInt32BE()
            % this.servers.length
        )
    }

    //Получить клиент по индексу
    getServer(index:number):RedisClient{
        return this.servers[index]
    }

    //Количество клиентов
    get length():number{
        return this.servers.length
    }
}

//endregion

//region connect to redis
import { RedisClient, ClientOpts, Multi } from 'redis'

//Что-то типа фабрики клиентов
function getRedis(opts: ClientOpts): RedisClient{
    const c = new RedisClient(opts)
    c.on('error', err=> console.error(err))
    return c;
}
///endregion

type EventCallback = (data:unknown, channel?:string)=> void;

/**
 * Интерфейс общения между клиентами,
 * именно тут мы подписываемся на события и пушим свои
 */
class MessagesBus{

    //Хранилище подписок
    private readonly evt: {[index:string]:EventCallback[]}[] = [];

    //Клиенты для подписок
    private readonly sub: HashPartitoning;

    //Клиенты для пуша
    private readonly pub: HashPartitoning;

    constructor(opts:ClientOpts[]){
        this.sub = new HashPartitoning(opts)
        this.pub = new HashPartitoning(opts)

        //Навешиваем обработчик для входящих сообщений
        for (let i = 0; i < opts.length; i++){
            const e = {}
            this.evt.push(e)
            this.sub.getServer(i).on("messageBuffer", (chBuff:Buffer, data:Buffer)=> {
                const channel = chBuff.toString()
                if (!e[channel]) return;
                console.log(`${clc.bold(clc.green("REC  "+i))} ${clc.yellow(channel)} ${JSON.stringify(msgpack.decode(data))}`)
                e[channel].forEach(c=> c(msgpack.decode(data), channel))
            })
        }
    }

    /**
     * Подписка на канал
     * Можно сколько угодно подписываться на один и тот же канал,
     * но реальная подписка в клиенте редиса на указанный канал 
     * производится только один раз, если до этого не было локальных подписчиков
     */
    join(channel:string, cb:EventCallback):void{
        const i = this.sub.indexOf(channel)
        const e = this.evt[i]
        if (!e[channel]) e[channel] = []
        const c = e[channel]

        //Подписываемся на клиенте
        if (c.length == 0) {
            this.sub.getServer(i).subscribe(channel)
            console.log(`${clc.bold(clc.yellow("SUB  "+i))} ${clc.yellow(channel)}`)
        }

        //Подписываемся локально
        if (!!~c.indexOf(cb)) throw new Error(`Duplicate callback for "${channel}"`)
        c.push(cb)
        console.log(`${clc.bold(clc.yellow("JOIN "+i))} ${clc.yellow(channel)}`)
    }

    /**
     * Отписка от канала
     * Можно сколько угодно отписываться от одного и того же канала,
     * но реальная отписка в клиенте редиса на указанный канал 
     * производится только один раз, если уже действительно нет локальных подписчиков
     */
    leave(channel:string, cb:EventCallback):void{
        const i = this.sub.indexOf(channel)
        const e = this.evt[i]
        if (!e[channel]) throw new Error(`Channel "${channel}" does not have any listeners`)
        const c = e[channel]
        const cb_index = c.indexOf(cb)
        if (!~cb_index) throw new Error(`Callback for "${channel}" does not exists`)
        
        //Удаляем подписку локально
        c.splice(cb_index, 1)
        console.log(`${clc.bold(clc.yellow("LEAVE"+i))} ${clc.yellow(channel)}`)
        if (c.length > 0) return;

        //Удаляем подписку полностью
        this.sub.getServer(i).unsubscribe(channel)
        delete e[channel]
        console.log(`${clc.bold(clc.yellow("UNSUB"+i))} ${clc.yellow(channel)}`)
    }

    /**
     * Пушим сообщение в канал
     */
    publish(channel:string, data:unknown):void{
        const i = this.sub.indexOf(channel)
        console.log(`${clc.bold(clc.blue("PUB  "+i))} ${clc.yellow(channel)} ${JSON.stringify(data)}`)
        this.pub.getServer(i).publish(channel, msgpack.encode(data))
    }

    /**
     * Получить количество подписчиков на указанные каналы
     */
    async numSubs(channels:string[]):Promise<{[index:string]:number}>{
        const sep:{[index:number]:string[]} = channels.reduce((p, c)=> {
            const i = this.sub.indexOf(c)
            p[i] = p[i] || []
            p[i].push(c)
            return p
        }, {})
        return (await Promise.all<{[index:string]:number}>(Object.keys(sep)
            .map(i=> new Promise((resolve, reject)=> {
                this.pub.getServer(parseInt(i)).pubsub("NUMSUB", sep[i], (err, whyIAmANumber)=> {
                    if (err) reject(err)
                    const s = <string[]><any>whyIAmANumber
                    const co = {}
                    while(s.length > 0){
                        const k = s.shift()
                        const v = s.shift()
                        if (!k || !v) continue;
                        co[k] = v
                    }
                    resolve(co)
                })
        })))).reduce((p, c)=> {
            return {...p, ...c}
        }, {})
    }
}

const bus = new MessagesBus([{
    host: 'msg-bus-0',
    port: 6379
}, {
    host: 'msg-bus-1',
    port: 6379
}])

//endregion

//region dialogs

/**
 * Интерфейс отвечающий за работу с комнатами (диалогами)
 */
class DialogsConrtoller{
    
    private readonly dcache:HashPartitoning;

    constructor(){
        this.dcache = new HashPartitoning([{
            host: 'dialogs-cache',
            port: 6379
        }])
    }

    /**
     * Получить диалог по идентификатору
     */
    async get(id:string):Promise<string[]>{
        if (!id) throw new Error(`No dialog id passed`)
        return await new Promise<string[]>((resolve, reject)=> {
            this.dcache.serverOf(id).smembers(id, (err, item)=> err ? reject(err) : resolve(item))
        })
    }

    /**
     * Тоже получение диалога по идентификатору, но с проврекой
     * является ли указанный пользователь его участником 
     */
    async getFor(uid:string, did:string):Promise<string[]>{
        if (!uid) throw new Error(`No uid passed`)
        if (!did) throw new Error(`No dialog id passed`)
        const members = await this.get(did)
        if (!~members.indexOf(uid)) throw new Error(`User "${uid}" doesn't have access to dialog "${did}"`)
        return members;
    }

    /**
     * Добавить участника в диалог
     */
    add(id, member):void{
        this.dcache.serverOf(id).sadd(id, member)
    }

    /**
     * Удалить участника с диалога
     */
    remove(id, member):void{
        this.dcache.serverOf(id).srem(id, member)
    }
}

const dc = new DialogsConrtoller()

//endregion

interface Message{
    method: string,
    data: string
}

import * as SocketIO from 'socket.io'
const io = SocketIO(3000, {
    // transports: ['websocket']
})

/**
 * Оборачивание идентификатора пользователя в имя канала пользователя
 */
function toUserChan(uid:string):string{
    return `u:${uid}`
}

/**
 * Оборачивание идентификатора пользователя в имя канала изменения состояния статуса пользователя
 */
function toOnlineStatChan(uid:string):string{
    return `s:${uid}`
}

/**
 * Извлечение идентификатора пользователя из имени канала
 */
function fromUserChan(channel:string):string{
    return channel.slice(2)
}

io.on('connection', sock=>{
    //Идентификатор текущего пользователя
    let UID = ''

    //Метод отлавивающий входящие сообщения пользователю от редиса
    function receiveMessage(data:unknown):void{
        const msg:Message = <Message>data
        sock.emit(msg.method, msg.data)
    }

    sock.on('auth', async (uid, resp)=> {
        console.log(`User ${uid} authorized`)
        const uchan = toUserChan(uid)
        const subs = await bus.numSubs([uchan])
        if (!subs[uchan]) bus.publish(toOnlineStatChan(uid), true)
        bus.join(uchan, receiveMessage)
        resp(uid)
        UID = uid
    })

    /**
     * Отписка от канала пользователя, 
     * уведомление об уходе оффлайн 
     * если этот человек больше нигде не залогинен
     */
    async function logout(){
        if (!UID) return;
        const uchan = toUserChan(UID)
        bus.leave(uchan, receiveMessage)
        const subs = await bus.numSubs([uchan])
        if (!subs[uchan]) bus.publish(toOnlineStatChan(UID), false)
        UID = ''
    }

    sock.on('logout', async ()=> {
        await logout()
    })

    //Список пользователей от которых мы хотим получать обновления об изменении онлайн статуса
    const statSubs = new Set()

    //Метод отлавливающий сообщения об изменении онлайн статусов
    function receiveStatus(data, channel):void{
        sock.emit('statusChange', {
            user: fromUserChan(channel),
            online: data
        })
    }

    sock.on('updStatSubs', async changes=> {
        if (changes.unsub) changes.unsub.forEach(uid=> {
            const uchan = toOnlineStatChan(uid)
            if (!statSubs.has(uchan)) throw new Error(`You already unsubscribed from ${uid}`)
            statSubs.delete(uchan)
            bus.leave(uchan, receiveStatus)
        })
        if (changes.sub) changes.sub.forEach(uid=> {
            const uchan = toOnlineStatChan(uid)
            if (statSubs.has(uchan)) throw new Error(`You already subscribed to ${uid}`)
            statSubs.add(uchan)
            bus.join(uchan, receiveStatus)
        })
    })

    sock.on('createChat', async data=> {
        dc.add(data.dialog, UID)
        bus.publish(toUserChan(UID), {
            method: 'memberAdded', data: {
                dialog: data.dialog,
                member: UID
            }
        })
    })

    sock.on('write', async data=> {
        const members = await dc.getFor(UID, data.dialog)
        members.forEach(u=> {
            bus.publish(toUserChan(u), {
                method: 'write', data: data
            })
        })
    })

    sock.on('addMember', async data=> {
        const members = await dc.getFor(UID, data.dialog)
        dc.add(data.dialog, data.member)
        ;[...members, data.member].forEach(u=> {
            bus.publish(toUserChan(u), {
                method: 'memberAdded', data: data
            })
        })
    })

    sock.on('removeMember', async data=> {
        const members = await dc.getFor(UID, data.dialog)
        dc.remove(data.dialog, data.member)
        members.forEach(u=> {
            bus.publish(toUserChan(u), {
                method: 'memberRemoved', data: data
            })
        })
    })

    sock.on('whoIsOnline', async (users:string[], resp)=> {
        const subs = await bus.numSubs(users.map(u=> toUserChan(u)))
        resp(Object.keys(subs).map(uc=> fromUserChan(uc)))
    })

    /**
     * Метод очистки от подписок, должен обязательно сррабатывать при отключении пользователя
     */
    async function cleanup():Promise<void>{
        statSubs.forEach(s=> bus.leave(s, receiveStatus))
        await logout()        
    }

    sock.on('disconnect', async (err)=> {
        console.log(`Disconnecting ${err}`)
        await cleanup()
    })
})

process.on('unhandledRejection', (err)=> {
    console.error(clc.red(`ERR: ${err.message}`))
})