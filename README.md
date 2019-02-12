# Распределенный чат на Node.JS и Redis

## Установка и запуск

Установка

```bash
npm i typescript ts-node -g
docker-compose -f "docker-compose.yml" up -d --build
```

Серверы доступны на портах **3001** и **3002**, их логи можно посмотреть:

```bash
docker logs distributed-nodejs-chat-with-redis_sock-app-1_1 --tail 50 -
```

..и:

```bash
docker logs distributed-nodejs-chat-with-redis_sock-app-0_1 --tail 50 -f
```

Чтобы поднять клиента заходим в папку `sock-app` и выполняем:

```bash
ts-node src/TestClient.ts %PORT%
```

## Команды

Клиент являет собой интерактивную консоль с заданными командами

| Description | Call | Full name |
| -- |:--| --:|
| Авторизоваться | a(`user_name`) | **A**uth |
| Разлогиниться  | lo() | **L**og **O**ut |
| Обновить список подписок | subs([`user_to_unsubscribe`], [`user_to_subscribe`]) | **Subs**cribtions |
| Узнать кто из списка пользователей онлайн | o([`user_name`]) | **O**nline |
| Написать сообщение в комнату | w(`room`, `message`) | **W**rite |
| Создать комнату | cc(`room`) | **C**reate **C**hat |
| Добавить участника с комнаты | am(`room`, `member`) | **A**dd **M**ember |
| Удалить участника в комнату | rm(`room`, `member`) | **R**emove **M**ember |

[![asciicast](https://asciinema.org/a/227042.svg)](https://asciinema.org/a/227042)s