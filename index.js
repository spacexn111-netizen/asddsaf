const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
require('dotenv').config();
const axios = require("axios");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

/* =========================
    AYARLAR (ENV)
========================= */
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const KICK_CHANNEL = process.env.KICK_CHANNEL || "profiyes";
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;
const DEFAULT_IMAGE = "https://cdn.discordapp.com/attachments/1482410979349500129/1501599320749641799/image.png";

const SOCIALS = {
  kick: "https://kick.com/profiyes",
  youtube: "https://www.youtube.com/@Profiyes",
  tiktok: "https://www.tiktok.com/@profiyesclip",
  instagram: "https://www.instagram.com/profiyesclip"
};

const EMOJIS = {
  youtube: "1501590794463875112",
  kick: "1501593383561593032",
  tiktok: "1501590816743755807",
  instagram: "1501590913238175786"
};

let wasLive = false;

/* =========================
   EMBED & MESSAGE SYSTEM
========================= */
function createLiveMessage(text, image, extra = {}, type = "auto", sender = null) {
  const isAuto = type === "auto";
  const userMention = sender ? `<@${sender.id}>` : "";

  const embed = new EmbedBuilder()
    .setColor(isAuto ? "#7b2cbf" : "#00a8ff")
    .setAuthor({
        name: isAuto ? `🔴 ${extra.username || "Yayıncı"} CANLI` : `Profiyes Duyuru`, 
        iconURL: isAuto ? (extra.avatar || DEFAULT_IMAGE) : "https://cdn.discordapp.com/emojis/1501590929633710131.png"
    })
    .setTitle("DİSCORD´A GİTMEK İÇİN TIKLA")
    .setURL("https://www.discord.gg/profiyes")
    .setDescription(
      isAuto
        ? `💜 ${SOCIALS.kick}\n\n✨ ${text}\n\n 🟢 Canlı yayın başladı!`
        : `${text}\n\n<:member_list_icon:1488195069298085929> **Gönderen:** ${userMention}`
    )
    .setImage(image)
    .setFooter({
      text: "profiyes kick & discord system´s",
      iconURL: "https://cdn.discordapp.com/emojis/1488196627020644462.webp?size=96&animated=true"
    })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("KICK").setEmoji(EMOJIS.kick).setStyle(ButtonStyle.Link).setURL(SOCIALS.kick),
    new ButtonBuilder().setLabel("YOUTUBE").setEmoji(EMOJIS.youtube).setStyle(ButtonStyle.Link).setURL(SOCIALS.youtube),
    new ButtonBuilder().setLabel("TIKTOK").setEmoji(EMOJIS.tiktok).setStyle(ButtonStyle.Link).setURL(SOCIALS.tiktok),
    new ButtonBuilder().setLabel("INSTAGRAM").setEmoji(EMOJIS.instagram).setStyle(ButtonStyle.Link).setURL(SOCIALS.instagram)
  );

  // Bu kısım mesajın en altına (Embed dışına) etiketi atar
  return { 
    content: isAuto ? "🔴 **YAYIN BAŞLADI!** @everyone" : `🔔 Yeni Mesaj: ${userMention}`, 
    embeds: [embed], 
    components: [row] 
  };
}
/* =========================
      !kontrol KOMUTU
  ========================= */
  if (message.content === "!kontrol") {
    if (!hasPermission(message.member)) return message.reply("❌ Bu komutu kullanmaya yetkin yok.");

    try {
      const res = await axios.get(
        `https://kick.com/api/v2/channels/${KICK_CHANNEL}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          }
        }
      );

      const isLive = res.data.livestream !== null;
      const stream = res.data.livestream;
      const user = res.data.user;

      if (isLive) {
        const username = user?.username || KICK_CHANNEL;
        const avatar = user?.profile_pic || DEFAULT_IMAGE;
        let thumbnail = DEFAULT_IMAGE;

        if (stream?.thumbnail?.url) {
          thumbnail = stream.thumbnail.url.replace("{width}", "1280").replace("{height}", "720");
        }

        // createLiveMessage fonksiyonunu kullanarak mesajı hazırla
        const messageData = createLiveMessage(
          `🔴 Manuel Kontrol: Yayın şu an AKTİF!\n**Oyun:** ${stream?.categories?.[0]?.name || "Bilinmiyor"}\n**İzleyici:** ${stream?.viewer_count || 0}`, 
          thumbnail, 
          { username, avatar }, 
          "manual", // Manuel olduğu için @everyone atmaz, sadece göndereni etiketler
          message.author
        );

        return message.channel.send(messageData);
      } else {
        return message.reply("⚪ Şu an yayın kapalı gözüküyor.");
      }
    } catch (err) {
      console.error(err);
      return message.reply("❌ Kick API'sine bağlanırken bir hata oluştu (403 veya bağlantı sorunu).");
    }
  }

/* =========================
   KICK KONTROL (403 FIX)
========================= */
async function checkKick() {
  try {
    const res = await axios.get(
      `https://kick.com/api/v2/channels/${KICK_CHANNEL}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      }
    );

    const isLive = res.data.livestream !== null;
    const stream = res.data.livestream;
    const user = res.data.user;

    if (isLive && !wasLive) {
      const guild = await client.guilds.fetch(GUILD_ID);
      const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);

      const username = user?.username || KICK_CHANNEL;
      const avatar = user?.profile_pic || DEFAULT_IMAGE;
      let thumbnail = DEFAULT_IMAGE;

      if (stream?.thumbnail?.url) {
        thumbnail = stream.thumbnail.url.replace("{width}", "1280").replace("{height}", "720");
      }

      const messageData = createLiveMessage("Yayın başladı! Hemen katıl 💜", thumbnail, { username, avatar }, "auto");

      // Tüm üyelere DM gönderimi
      const members = await guild.members.fetch();
      for (const member of members.values()) {
        if (member.user.bot) continue;
        try {
          await member.send(messageData);
          await new Promise(r => setTimeout(r, 2000)); // Rate limit koruması
        } catch (e) {}
      }

      if (logChannel) logChannel.send("✅ Otomatik yayın bildirimi gönderildi.");
    }

    wasLive = isLive;
  } catch (err) {
    console.log("Kick Kontrol Hatası:", err.response?.status === 403 ? "403 Yasak (Cloudflare Engeli)" : err.message);
  }
}

/* =========================
   READY & LOGIN
========================= */
client.once("ready", () => {
  console.log(`Bot aktif: ${client.user.tag}`);
  // Her 1 dakikada bir kontrol et
  setInterval(checkKick, 60000);
});

client.login(TOKEN);
