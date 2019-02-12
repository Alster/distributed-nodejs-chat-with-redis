const clc = require('cli-color')
import * as IOClient from 'socket.io-client'

const connStr = `http://localhost:${process.argv[2] || '3333'}`
console.log(`Connecting to ${connStr}`)
const sock = IOClient(connStr, {
    transports: ['websocket']
})

sock.on('connect', (err)=> {
    console.log(clc.blue('Connected'))

    sock.on('write', data=> 
        console.log(`${clc.green('MSG')} from ${data.dialog}: ${data.msg}`))

    sock.on('memberAdded', data=> 
        console.log(`Member ${data.member} ${clc.green('added')} to ${data.dialog}`))
    
    sock.on('memberRemoved', data=> 
    console.log(`Member ${data.member} ${clc.red('removed')} from ${data.dialog}`))

    sock.on('statusChange', data=> 
    console.log(`User ${data.user} goes ${data.online ? clc.yellow("online") : clc.red("offline")}`))

    const Repl = require('repl')
    const repl = Repl.start({
        prompt: '> ',
        useColors: true,
        replMode: Repl.REPL_MODE_STRICT,
        ignoreUndefined: true
    })

    repl.context.a = (ruid)=> {
        sock.emit('auth', ruid.toString(), uid=> {
            console.log(`${clc.green('Authorized')} as ${uid}`)
        })
    }

    repl.context.lo = ()=> {
        sock.emit('logout')
    }

    repl.context.subs = (unsub, sub)=> {
        sock.emit('updStatSubs', {unsub, sub})
    }

    repl.context.o = (users)=> {
        sock.emit('whoIsOnline', users, (res)=> console.log(`${clc.blue('Online users')}: ${res.join(', ')}`))
    }

    repl.context.w = (dialog, msg)=> {
        sock.emit('write', {
            dialog: dialog.toString(), msg: msg.toString()
        })
    }

    repl.context.cc = (dialog)=> {
        sock.emit('createChat', {
            dialog: dialog.toString()
        })
    }

    repl.context.am = (dialog, member)=> {
        sock.emit('addMember', {
            dialog: dialog.toString(),
            member: member.toString()
        })
    }
    
    repl.context.rm = (dialog, member)=> {
        sock.emit('removeMember', {
            dialog: dialog.toString(),
            member: member.toString()
        })
    }
})