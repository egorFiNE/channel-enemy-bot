import assert from 'assert';
import { resolveEntities, includesScamUrlInEntities, includesDiaInEntities } from '../lib/AntiSpamEntities.mjs';

const MSG = {
  "message_id": 111,
  "from": {
    "id": 111,
    "is_bot": false,
    "first_name": "Barack",
    "last_name": "Obama",
    "username": "potus",
    "language_code": "en"
  },
  "chat": {
    "id": -111111111,
    "title": "Whitehouse chat",
    "type": "supergroup"
  },
  "date": 1652299404,
  "text": "тестик \n\n@diacar_bot\n\nhttps://mono-bank.c\n\n@diacar_bot",
  "entities": [
    {
      "offset": 9,
      "length": 11,
      "type": "mention"
    },
    {
      "offset": 22,
      "length": 19,
      "type": "url"
    },
    {
      "offset": 43,
      "length": 11,
      "type": "mention"
    }
  ]
};

const MSG_CLEAR = {
  "message_id": 111,
  "from": {
    "id": 111,
    "is_bot": false,
    "first_name": "Donald",
    "last_name": "Trump",
    "username": "retarder",
    "language_code": "en"
  },
  "chat": {
    "id": -111111,
    "title": "shithole",
    "type": "supergroup"
  },
  "date": 1652299404,
  "text": "тестик \n\n@runcar_bot\n\nhttps://example.com\n\n@runcar_bot",
  "entities": [
    {
      "offset": 9,
      "length": 11,
      "type": "mention"
    },
    {
      "offset": 22,
      "length": 19,
      "type": "url"
    },
    {
      "offset": 43,
      "length": 11,
      "type": "mention"
    }
  ]
};

const MSG_RESOLVED_ENTITIES = {
  "message_id": 111,
  "from": {
    "id": 111,
    "is_bot": false,
    "first_name": "Barack",
    "last_name": "Obama",
    "username": "potus",
    "language_code": "en"
  },
  "chat": {
    "id": -111111111,
    "title": "Whitehouse chat",
    "type": "supergroup"
  },
  "date": 1652299404,
  "text": "тестик \n\n@diacar_bot\n\nhttps://mono-bank.c\n\n@diacar_bot",
  "entities": [
    {
      "offset": 9,
      "length": 11,
      "type": "mention",
      "value": "@diacar_bot"
    },
    {
      "offset": 22,
      "length": 19,
      "type": "url",
      "value": "https://mono-bank.c"
    },
    {
      "offset": 43,
      "length": 11,
      "type": "mention",
      "value": "@diacar_bot"
    }
  ]
};

resolveEntities(MSG);
resolveEntities(MSG_CLEAR);

describe('AntiSpamEntities', function () {
  it('resolveEntities', function () {
    assert.deepEqual(MSG, MSG_RESOLVED_ENTITIES);
  });

  it('includesDiaInEntities', function () {
    assert.ok(includesDiaInEntities(MSG.entities));
  });

  it('does not includesDiaInEntities', function () {
    assert.ok(!includesDiaInEntities(MSG_CLEAR.entities));
  });

  it('includesScamUrlInEntities', function () {
    assert.ok(includesScamUrlInEntities(MSG.entities));
  });

  it('does not includesScamUrlInEntities', function () {
    assert.ok(!includesScamUrlInEntities(MSG_CLEAR.entities));
  });
});
