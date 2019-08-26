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

function isAsian(name) {
	return new Promise((resolve, reject) => {
		detectLanguage.detect(name, (err, result) => {
			if (err) {
				reject(err);
				return;
			}

			if (!result || result.length == 0) {
				reject(new Error("No idea"));
				return;
			}

			const language = (result[0].language || '').toLowerCase();
			if (!language) {
				reject(new Error("no language"));
				return;
			}

			resolve(
				language.startsWith('zh') || language.startsWith('za') ||
				language.startsWith('vi') || language.startsWith('ko') ||
				language.startsWith('ja')
			);
		});
	});
}

bot.on('new_chat_members', async msg => {
	for (const member of msg.new_chat_members) {
		if (member.is_bot) {
			continue;
		}

		let name = member.first_name;
		if (member.last_name) {
			name += ' ' + member.last_name;
		}

		try {
			const shouldBan = await isAsian(name);
			member.shouldBan = shouldBan;
		} catch (e) {
			console.log(e);
			member._error = e.toString();
		}
	}

	fs.appendFileSync('chat.json', JSON.stringify(msg) + "\n");
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
