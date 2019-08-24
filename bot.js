'use strict';

// https://t.me/joinchat/ACtZWBdMm6xkL0mEVLgUCg

const config = require('./config');

const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const DetectLanguage = require('detectlanguage');

const bot = new TelegramBot(config.TELEGRAM_TOKEN, { polling: true });
const detectLanguage = new DetectLanguage({
	key: config.DETECTLANGUAGE_TOKEN,
	ssl: false
});

// [{"language":"zh","isReliable":false,"confidence":0.01}]
	// detectLanguage.detect(phrase, function(error, result) {
  //   console.log(JSON.stringify(result));
	// });

bot.on('new_chat_members', msg => {
	fs.appendFileSync('chat.json', JSON.stringify(msg) + "\n");
	console.log(msg);
});

/*
{
  message_id: 3,
  from: {
    id: 2840920,
    is_bot: false,
    first_name: 'Vartan',
    last_name: 'Egorov',
    username: 'kvazimbek'
  },
  chat: {
    id: -390896556,
    title: 'test',
    type: 'group',
    all_members_are_administrators: true
  },
  date: 1566649477,
  new_chat_participant: {
    id: 2840920,
    is_bot: false,
    first_name: 'Vartan',
    last_name: 'Egorov',
    username: 'kvazimbek'
  },
  new_chat_member: {
    id: 2840920,
    is_bot: false,
    first_name: 'Vartan',
    last_name: 'Egorov',
    username: 'kvazimbek'
  },
  new_chat_members: [
    {
      id: 2840920,
      is_bot: false,
      first_name: 'Vartan',
      last_name: 'Egorov',
      username: 'kvazimbek'
    }
  ]
}
*/
