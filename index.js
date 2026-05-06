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
   AYARLAR
========================= */
/* =========================
    AYARLAR (ENV İLE)
========================= */
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const ROLE_ID = process.env.ROLE_ID;
const KICK_CHANNEL = process.env.KICK_CHANNEL;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

// Liste halindeki verileri env'den çekerken virgülle ayırıp diziye çeviriyoruz
const ALLOWED_USERS = process.env.ALLOWED_USERS ? process.env.ALLOWED_USERS.split(",") : [];
const ALLOWED_ROLES = process.env.ALLOWED_ROLES ? process.env.ALLOWED_ROLES.split(",") : [];

const DEFAULT_IMAGE =
  "https://cdn.discordapp.com/attachments/1482410979349500129/1501599320749641799/image.png";

/* =========================
   SOSYAL LİNKLER (DOLDUR)
========================= */
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
   EMBED SYSTEM
========================= */
function createLiveMessage(text, image, extra = {}, type = "auto", sender = null) {
  const isAuto = type === "auto";

  const embed = new EmbedBuilder()
    .setColor(isAuto ? "#7b2cbf" : "#00a8ff")
.setAuthor({
    name: isAuto
        ? `🔴 ${extra.username || "Yayıncı"} CANLI`
        : `Profiyes Duyuru`, 
    iconURL: isAuto
        ? (extra.avatar || DEFAULT_IMAGE)
        : "https://cdn.discordapp.com/emojis/1501590929633710131.png" // Emoji ID'sini direkt resim linki yaptık
})
 .setTitle("DİSCORD´A GİTMEK İÇİN TIKLA") // Sadece yazı
.setURL("https://www.discord.gg/profiyes") // Başlığı linke çeviren kısım
    .setDescription(
      isAuto
        ? `💜 ${SOCIALS.kick}\n\n✨ ${text}\n\n 🟢 Canlı yayın başladı!`
        : `${text}\n\n <:member_list_icon:1488195069298085929> Gönderen: <@${sender?.id}>`
    )
    .setImage(image)
    .setFooter({
      text: "profiyes kick & discord system´s",
      iconURL: "https://cdn.discordapp.com/emojis/1488196627020644462.webp?size=96&animated=true"
    })
    .setTimestamp();

const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setLabel("KICK")
    .setEmoji(EMOJIS.kick)
    .setStyle(ButtonStyle.Link)
    .setURL(SOCIALS.kick),

  new ButtonBuilder()
    .setLabel("YOUTUBE")
    .setEmoji(EMOJIS.youtube)
    .setStyle(ButtonStyle.Link)
    .setURL(SOCIALS.youtube || "https://youtube.com"),

  new ButtonBuilder()
    .setLabel("TIKTOK")
    .setEmoji(EMOJIS.tiktok)
    .setStyle(ButtonStyle.Link)
    .setURL(SOCIALS.tiktok || "https://tiktok.com"),

  new ButtonBuilder()
    .setLabel("INSTAGRAM")
    .setEmoji(EMOJIS.instagram)
    .setStyle(ButtonStyle.Link)
    .setURL(SOCIALS.instagram || "https://instagram.com")
);

  // 🔥 KRİTİK FIX
  return { embed, row };
}


/* =========================
   KICK KONTROL
========================= */
async function checkKick() {
  try {
    const res = await axios.get(
      `https://kick.com/api/v2/channels/${KICK_CHANNEL}`
    );

    const isLive = res.data.livestream !== null;
    const stream = res.data.livestream;
    const user = res.data.user;

    const avatar =
      user?.profile_pic || user?.profile_picture || DEFAULT_IMAGE;

    const game =
      stream?.categories?.[0]?.name ||
      stream?.category?.name ||
      "Bilinmiyor";

    const viewers = stream?.viewer_count || 0;
    const username = user?.username || KICK_CHANNEL;

    let thumbnail = DEFAULT_IMAGE;

    if (stream?.thumbnail?.url) {
      thumbnail = stream.thumbnail.url
        .replace("{width}", "1280")
        .replace("{height}", "720");
    }

    /* =========================
       AUTO LIVE (HERKESE DM)
    ========================= */
    if (isLive && !wasLive) {
      const guild = await client.guilds.fetch(GUILD_ID);
      const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);

      const { embed, row } = createLiveMessage(
        "Yayın başladı! Hemen katıl 💜",
        thumbnail,
        { username, avatar, game, viewers },
        "auto"
      );

      const members = await guild.members.fetch();

      for (const member of members.values()) {
        if (member.user.bot) continue;

        try {
          await member.send({
            embeds: [embed],
            components: [row]
          });

          await new Promise(r => setTimeout(r, 1200));
        } catch {}
      }

      if (logChannel) {
        logChannel.send("✅ Otomatik yayın bildirimi gönderildi.");
      }
    }

    wasLive = isLive;
  } catch (err) {
    console.log("Kick hata:", err.message);
  }
}

/* =========================
   PERMISSION
========================= */
function hasPermission(member) {
  if (ALLOWED_USERS.includes(member.id)) return true;
  if (member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id)))
    return true;
  return false;
}

/* =========================
   !dm COMMAND
========================= */
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  /* =========================
     PANEL
  ========================= */
  if (message.content === "!panel") {
    const embed = new EmbedBuilder()
      .setColor("#7b2cbf")
      .setTitle("🎛️ Panel")
      .setDescription("Sosyal medya ve bağlantılar aşağıda 👇");

const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setLabel("KICK")
    .setEmoji(EMOJIS.kick)
    .setStyle(ButtonStyle.Link)
    .setURL(SOCIALS.kick),

  new ButtonBuilder()
    .setLabel("YOUTUBE")
    .setEmoji(EMOJIS.youtube)
    .setStyle(ButtonStyle.Link)
    .setURL(SOCIALS.youtube || "https://youtube.com"),

  new ButtonBuilder()
    .setLabel("TIKTOK")
    .setEmoji(EMOJIS.tiktok)
    .setStyle(ButtonStyle.Link)
    .setURL(SOCIALS.tiktok || "https://tiktok.com"),

  new ButtonBuilder()
    .setLabel("INSTAGRAM")
    .setEmoji(EMOJIS.instagram)
    .setStyle(ButtonStyle.Link)
    .setURL(SOCIALS.instagram || "https://instagram.com")
);

    return message.channel.send({ embeds: [embed], components: [row] });
  }

  /* =========================
     !dm
  ========================= */
  if (!message.content.startsWith("!dm")) return;

  if (!hasPermission(message.member)) {
    return message.reply("❌ Yetkin yok.");
  }

  const args = message.content.split(" ");
  if (args.length < 3) {
    return message.reply("Kullanım: !dm (id) mesaj");
  }

  const targetId = args[1];
  const msg = args.slice(2).join(" ");

  const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);

  const { embed, row } = createLiveMessage(
    ` ${msg}`,
    DEFAULT_IMAGE,
    {},
    "dm",
    message.author
  );

  try {
    const role = message.guild.roles.cache.get(targetId);

    if (role) {
      for (const member of role.members.values()) {
        try {
          await member.send({ embeds: [embed], components: [row] });
          await new Promise(r => setTimeout(r, 1000));
        } catch {}
      }
    } else {
      const user = await client.users.fetch(targetId);
      await user.send({ embeds: [embed], components: [row] });
    }

    if (logChannel) {
      logChannel.send(` ${message.author.tag} DM gönderdi: ${msg}`);
    }

    await message.delete().catch(() => {});
  } catch (err) {
    message.reply("❌ Hata oluştu.");
  }
});

/* =========================
   READY
========================= */
client.once("ready", () => {
  console.log(`Bot aktif: ${client.user.tag}`);
  setInterval(checkKick, 60000);
});
client.once("clientReady", () => {
  console.log(`Bot aktif: ${client.user.tag}`);
  setInterval(checkKick, 60000);
});
client.login(TOKEN);