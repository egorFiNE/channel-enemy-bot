export function resolveEntities(msg) {
	if (!msg.entities) {
		return;
	}

	for (const entity of msg.entities) {
		entity.value = msg.text.substring(entity.offset, entity.offset + entity.length);

		if (entity.type  == 'url' && entity.value.startsWith('https://t.me/')) {
			entity.type = 'mention';
			entity.value = entity.value.replaceAll('https://t.me/', '@');
		}
	}
}

export function includesScamUrlInEntities(entities) {
	const foundBannedHostname = entities
		.filter(e => e.type == 'url')
		.map(e => {
			try {
				return new URL(e.value);
			} catch {
				return null;
			}
		})
		.filter(url => Boolean(url))
		.map(url => url.hostname)
		.map(hostname => hostname.replace(/^www\./, ''))
		.find(hostname => {
			return hostname.includes('mono-bank') || hostname.includes('test-ban-domain');
		});

	return Boolean(foundBannedHostname);
}

export function includesDiaInEntities(entities) {
	const foundDia = entities
		.filter(e => e.type == 'mention')
		.filter(e => e.value?.endsWith('bot'))
		.find(e =>
			e.value.includes('dia') ||
			e.value.includes('diia') ||
			e.value.includes('diya') ||
			e.value.includes('dyia') ||
			e.value.includes('diia') ||
			e.value.includes('diiya')
		);

	return Boolean(foundDia);
}
