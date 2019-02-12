# Распределенный чат на Node.JS и Redis

- [Распределенный чат на Node.JS и Redis](#%D1%80%D0%B0%D1%81%D0%BF%D1%80%D0%B5%D0%B4%D0%B5%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9-%D1%87%D0%B0%D1%82-%D0%BD%D0%B0-nodejs-%D0%B8-redis)
  - [Установка и запуск](#%D1%83%D1%81%D1%82%D0%B0%D0%BD%D0%BE%D0%B2%D0%BA%D0%B0-%D0%B8-%D0%B7%D0%B0%D0%BF%D1%83%D1%81%D0%BA)
  - [Команды](#%D0%BA%D0%BE%D0%BC%D0%B0%D0%BD%D0%B4%D1%8B)
  - [Скринкасты](#%D1%81%D0%BA%D1%80%D0%B8%D0%BD%D0%BA%D0%B0%D1%81%D1%82%D1%8B)

## Установка и запуск

Установка

```bash
npm i typescript ts-node -g
docker-compose -f "docker-compose.yml" up -d --build
```

Серверы доступны на портах **3001** и **3002**, их логи можно посмотреть:

```bash
docker logs distributed-nodejs-chat-with-redis_sock-app-0_1 --tail 50 -f
```

..и:

```bash
docker logs distributed-nodejs-chat-with-redis_sock-app-1_1 --tail 50 -f
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

## Скринкасты

Чат с двумя участниками

[![asciicast](https://asciinema.org/a/227099.svg)](https://asciinema.org/a/227099)

Онлайн статус

[![asciicast](https://asciinema.org/a/227104.svg)](https://asciinema.org/a/227104)

Множество участников

[![asciicast](https://asciinema.org/a/227110.svg)](https://asciinema.org/a/227110)