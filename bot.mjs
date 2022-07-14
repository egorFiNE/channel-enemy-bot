/* eslint-disable camelcase */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import url from 'url';
import TelegramBot from 'node-telegram-bot-api';
import DetectLanguage from 'detectlanguage';
import Sequelize from 'sequelize';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const sequelize = new Sequelize({
	logging: false,
  dialect: 'sqlite',
  storage: path.join(__dirname, 'stats.sqlite3')
});

class Stats extends Sequelize.Model {}
Stats.init({
	chatId: {
		type: Sequelize.DataTypes.STRING,
		allowNull: false,
		primaryKey: true
	},
	memberId: {
		type: Sequelize.DataTypes.STRING,
		allowNull: false,
		primaryKey: true
	},
	lastSeen: {
		type: Sequelize.DataTypes.DATE,
		allowNull: false
	}
}, {
	sequelize,
	timestamps: false,
	modelName: 'Stats'
});

sequelize.sync();

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const detectLanguage = new DetectLanguage(process.env.DETECTLANGUAGE_TOKEN);

const chatNameById = {
	'-1001203773023': '@miniclubua',
	'-1001337527238': '@miniclubodesa',
	'-1001367232670': '@miniclublviv',
	'-1001422187907': 'kiev',
	'-1001257154538': '@BEETLE_CLUB_UKRAINE',
	'-1001486470983': '@BEETLE_Market_UA',
	'-1001410584885': 'Флуд лампо алко чат',
	'-1001637271384': '@miniclubchernivtsi'
};

const adminsIdsByChatId = {
	'-1001203773023': [ '2840920', '16292769', '128480671', '131315930' ], // ua
	'-1001337527238': [ '2840920' ], // odessa
	'-1001367232670': [ '2840920', '445840984' ], // lviv
	'-1001637271384': [ '382743634' ],
	'-1001257154538': [ '159021158' ],
	'-1001486470983': [ '159021158', '2840920' ]
};

const isStatsEnabledByChatId = {
	'-1001203773023': true,
	'-1001337527238': true,
	'-1001367232670': true,
	'-1001422187907': true,
	'-1001257154538': true,
	'-1001410584885': true,
	'-1001637271384': true,
	'-1001486470983': true
};

let helloTemplateByChatId = {};

const WELCOME_TIMEOUT_MS = 2000;

const HELLO_HELP =
`To see current welcome message for a channel:

\`/hello @channel\`

To change it:

\`/hello @channel blah blah\`

Make sure to put \`%NAME%\` somewhere in the hello message to mention the newcomer.
`;

const NOT_WELCOME_MESSAGE =
`Hi. I'm a private bot managing a count of specific Telegram channel. There is nothing I can do for you, so goodbye and have a nice day :-)

Привет! Я частный бот, работающий только на парочке секретных телеграм каналов, поэтому ничем не могу вам быть полезен. До свидания и хорошего дня! :-)

(Если ты админ, то ты знаешь, как мной пользоваться)`;

// protect admins from being banned
const WHITE_LIST = [
	2840920 // kvazimbek
];

const NOTIFY_CHAT_ID = 2840920; // kvazimbek

const HELLO_PATH = path.join(__dirname, 'hello.json');

function loadHello() {
	const helloString = fs.readFileSync(HELLO_PATH).toString();
	helloTemplateByChatId = JSON.parse(helloString); // let it crash in case there's an error
}

function storeHello() {
	fs.writeFileSync(HELLO_PATH, JSON.stringify(helloTemplateByChatId, null, "\t"));
}

function chatIdByName(name) {
	for (const [ chatId, chatName ] of Object.entries(chatNameById)) {
		if (chatName.toLowerCase() == name.toLowerCase()) {
			return chatId;
		}
	}

	return null;
}

function touch({ chatId, memberId }) {
	return sequelize.models.Stats.upsert(
		{
			chatId,
			memberId,
			lastSeen: new Date()
		}
	);
}

async function isAsian(member) {
	const name = renderFullname(member);

	if (name.match(/vova/i)) { // asian lang detects this as true
		return false;
	}

	let result;
	try {
		result = await detectLanguage.detect(name);
	} catch {
		console.error("Language detect: error");
		return false;
	}

	if (!result || result.length == 0) {
		console.error("language detect: empty result");
		return false;
	}

	const language = (result[0].language || '').toLowerCase();
	if (!language) {
		console.error("language detect: not detected");
		return false;
	}

	return language.startsWith('zh') || language.startsWith('za') ||
		language.startsWith('vi') || language.startsWith('ko') ||
		language.startsWith('ja');
}

async function banMembers(chatId, members) {
	const logStructure = JSON.stringify({ date: Date.now(), chatId, members });
	fs.appendFileSync('banList.json', logStructure + "\n");

	for (const member of members) {
		try {
			await bot.banChatMember(chatId, member.id);
		} catch (e) {
			console.log(e);
		}
	}

	const notificationMembers = members.map(member => {
		const result = [ member.id ];
		if (member.username) {
			result.push('@' + member.username);
		}
		result.push(renderFullname(member));
		return result.join(' ');
	});

	const notificationString = notificationMembers.join("\n\n") + "\n";

	bot.sendMessage(NOTIFY_CHAT_ID, notificationString, {
		disable_notification: true
	});
}

function createWelcomeMessageByChatId({ chatId, member }) {
	const template = helloTemplateByChatId[chatId];
	if (!template) {
		return null;
	}

	const mention = renderFullname(member);

	return template
		.replaceAll('%NAME%', '[%MENTION%](tg://user?id=%MEMBER_ID%)')
		.replaceAll('%MEMBER_ID%', member.id)
		.replaceAll('%MENTION%', mention);
}

function welcomeMembers(chatId, members) {
	if (!helloTemplateByChatId[chatId]) {
		return;
	}

	// no need to await, fire-and-forget
	Promise.all(
		members.map(member => {
			const message = createWelcomeMessageByChatId({ chatId, member });
			if (!message) {
				return null;
			}

			return bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
		})
	);
}

function renderFullname({ first_name, last_name }) {
	let name = (first_name || '').trim();
	if (last_name) {
		name += ' ' + last_name.trim();
	}
	return name;
}

function isAdmin(fromId, channelChatId) {
	const admins = adminsIdsByChatId[channelChatId];
	return admins ? admins.includes(String(fromId)) : false;
}

function processHelloConfigurations({ text, fromId, chatId }) {
	const s = text.split(/\s+/);
	if (s.length == 0) { // can't be, but still
		return;
	}

	if (s.length == 1) {
		bot.sendMessage(chatId, HELLO_HELP, { parse_mode: 'Markdown' });
		return;
	}

	// s.length > 1

	const channelName = s[1];
	const channelChatId = chatIdByName(channelName);
	if (!channelChatId) {
		bot.sendMessage(chatId, "I don't know that channel, sorry.", { parse_mode: 'Markdown' });
		return;
	}

	if (!isAdmin(fromId, channelChatId)) {
		bot.sendMessage(chatId, "You don't have permission to change the hello message for that channel.", { parse_mode: 'Markdown' });
		return;
	}

	if (s.length == 2) {
		const template = helloTemplateByChatId[channelChatId];
		if (!template) {
			bot.sendMessage(chatId, "No hello for that channel", { parse_mode: 'Markdown' });
			return;
		}

		bot.sendMessage(chatId, template, { parse_mode: 'Markdown' });
		return;
	}

	helloTemplateByChatId[channelChatId] = s.slice(2).join(' ');
	bot.sendMessage(
		chatId,
		`Сохранил вот такое приветствие для ${chatNameById[channelChatId]}:\n\n` + helloTemplateByChatId[channelChatId],
		{ parse_mode: 'Markdown' }
	);

	storeHello();
}

function processSay({ text, fromId, chatId }) {
	const s = text.split(/\s+/);
	if (s.length == 0) { // can't be, but still
		return;
	}

	if (s.length == 1) {
		bot.sendMessage(chatId, "/say @channel text", { parse_mode: 'Markdown' });
		return;
	}

	// s.length > 1

	const channelName = s[1];
	const channelChatId = chatIdByName(channelName);
	if (!channelChatId) {
		bot.sendMessage(chatId, "I don't know that channel, sorry.", { parse_mode: 'Markdown' });
		return;
	}

	if (!isAdmin(fromId, channelChatId)) {
		bot.sendMessage(chatId, "You don't have permission to say in that channel.", { parse_mode: 'Markdown' });
		return;
	}

	bot.sendMessage(
		channelChatId,
		s.slice(2).join(' '),
		{ parse_mode: 'Markdown' }
	);
}

async function processPrivateMessage(msg) {
	const text = (msg.text || '').trim();
	const fromId = String(msg.from.id);
	const chatId = String(msg.chat.id);

	if (text == '/start') {
		await bot.sendMessage(chatId, NOT_WELCOME_MESSAGE, { parse_mode: 'Markdown' });
		return;
	}

	if (text == '/ping') {
		await bot.sendMessage(chatId, "Pong!");
		return;
	}

	if (text.startsWith('/hello')) {
		processHelloConfigurations({ text, fromId, chatId });
		return;
	}

	if (text.startsWith('/say')) {
		processSay({ text, fromId, chatId });
		return;
	}

	if (text == '/id') {
		await bot.sendMessage(chatId, fromId);
		return;
	}

	bot.sendMessage(chatId, NOT_WELCOME_MESSAGE, { parse_mode: 'Markdown' });
}

/**********************************/

loadHello();

bot.on('message', msg => {
	const isPrivate = msg.chat?.type !== 'supergroup';

	if (isPrivate) {
		processPrivateMessage(msg);
		return;
	}

	if (isStatsEnabledByChatId[msg.chat.id]) {
		touch({
			chatId: msg.chat.id,
			memberId: String(msg.from.id)
		});
	}
});

bot.on('new_chat_members', async msg => {
	fs.appendFileSync('newMembers.json', JSON.stringify(msg) + "\n");

	const membersToWelcome = [], membersToBan = [];

	for (const member of msg.new_chat_members) {
		if (member.is_bot) {
			continue;
		}

		if (!WHITE_LIST.includes(member.id)) {
			if (await isAsian(member)) {
				membersToBan.push(member);
				continue;
			}
		}

		if (helloTemplateByChatId[msg.chat.id]) {
			membersToWelcome.push(member);
		}
	}

	if (membersToBan.length > 0) {
		await banMembers(msg.chat.id, membersToBan);

		if (membersToBan.length == 1) {
			try {
				bot.deleteMessage(msg.chat.id, msg.message_id);
			} catch {
				// we ignore an error here because multiple bots may compete for service messages deletion
			}
		}
	}

	if (membersToWelcome.length > 0) {
		// let them see something before we say hi
		setTimeout(() => welcomeMembers(String(msg.chat.id), membersToWelcome), WELCOME_TIMEOUT_MS);
	}
});

bot.on('polling_error', error => {
  console.log('polling_error');
  console.log(error);
});
