import { Client } from 'discord.js';
import Pino from 'pino';
const logger = Pino({
  prettyPrint: true,
});

const DISCORD_TOKEN = process.env.AFK_DISCORD_TOKEN!;
const CATEGORY_AFK_CHANNELS = JSON.parse(process.env.AFK_CATEGORY_TO_CHANNEL!);

const client = new Client();

client.login(DISCORD_TOKEN);

client.on('ready', () => {
  logger.info({
    msg: 'logged in',
    userId: client.user?.id,
  });
});

type AFKInfo = {
  lastChannel?: string;
  timeout?: NodeJS.Timeout;
};

const memberAFKInfo: {
  [memberId: string]: AFKInfo | undefined;
} = {};

const processMember = async (memberId: string, guildId: string) => {
  const guild = client.guilds.resolve(guildId);
  const member = guild?.members.resolve(memberId);
  if (!member) return;
  if (!member.voice.channel || !member.voice.channel.parentID) return;

  memberAFKInfo[member.id] = {
    ...(memberAFKInfo[member.id] || {}),
    timeout: undefined,
  };

  logger.info({
    msg: 'processing tick',
    userId: member.user.id,
    guildId,
  });

  const afkChannelId = CATEGORY_AFK_CHANNELS[member.voice.channel.parentID];
  if (!afkChannelId) return;

  if (member.voice.selfDeaf === (member.voice.channel.id === afkChannelId))
    return;

  if (member.voice.selfDeaf) {
    memberAFKInfo[member.id]!.lastChannel = member.voice.channel.id;

    logger.info({
      msg: 'moving to AFK',
      userId: member.user.id,
      guildId: guildId,
    });

    member.voice.setChannel(afkChannelId);
  } else {
    if (!memberAFKInfo[member.id]!.lastChannel) return;

    logger.info({
      msg: 'moving out of AFK',
      userId: member.user.id,
      guildId: guildId,
    });

    member.voice.setChannel(memberAFKInfo[member.id]!.lastChannel!);
  }
};

client.on('voiceStateUpdate', async (_, newState) => {
  if (!newState.member) return;
  const memberId = newState.member.id;
  const guildId = newState.guild.id;

  if (memberAFKInfo[newState.member.id]?.timeout) {
    logger.info({
      msg: 'clearing timeout',
      userId: newState.member.user.id,
      guildId: newState.guild.id,
    });

    clearTimeout(memberAFKInfo[newState.member.id]!.timeout!);
    memberAFKInfo[newState.member.id]!.timeout === undefined;
  }

  const timeoutLength = newState.selfDeaf ? 1000 * 30 : 1000;

  logger.info({
    msg: 'setting tick timeout',
    userId: newState.member.user.id,
    guildId: newState.guild.id,
  });

  const timeout = setTimeout(() => {
    processMember(memberId, guildId);
  }, timeoutLength);

  memberAFKInfo[newState.member.id] = {
    ...(memberAFKInfo[newState.member.id] || {}),
    timeout,
  };
});
