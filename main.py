import discord
from discord.ext import commands
import yt_dlp
import asyncio
import os
import random
from collections import deque
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.getenv("DISCORD_TOKEN")

# ─── FFmpeg ──────────────────────────────────────────────────────────────
FFMPEG_EXECUTABLE = "ffmpeg"

FFMPEG_OPTIONS = {
    "before_options": "-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5",
    "options": "-vn",
}

# ─── YT-DLP ──────────────────────────────────────────────────────────────
YTDL_SEARCH_OPTIONS = {
    "format": "bestaudio/best",
    "noplaylist": False,
    "quiet": True,
    "no_warnings": True,
    "default_search": "ytsearch",
    "source_address": "0.0.0.0",
    "extract_flat": "in_playlist",
}

YTDL_STREAM_OPTIONS = {
    "format": "bestaudio/best",
    "noplaylist": True,
    "quiet": True,
    "no_warnings": True,
    "source_address": "0.0.0.0",
    "extractor_args": {
        "youtube": {
            "player_client": ["android"]
        }
    },
}

ytdl_search = yt_dlp.YoutubeDL(YTDL_SEARCH_OPTIONS)
ytdl_stream = yt_dlp.YoutubeDL(YTDL_STREAM_OPTIONS)

# ─── Bot ─────────────────────────────────────────────────────────────────
intents = discord.Intents.default()
intents.message_content = True
intents.voice_states = True

bot = commands.Bot(command_prefix="!", intents=intents, help_command=None)

# ─── Guild State ─────────────────────────────────────────────────────────
class GuildState:
    def __init__(self):
        self.queue = deque()
        self.current = None
        self.volume = 0.5
        self.loop = False

guild_states = {}

def get_state(guild_id):
    if guild_id not in guild_states:
        guild_states[guild_id] = GuildState()
    return guild_states[guild_id]

# ─── Helpers ─────────────────────────────────────────────────────────────
async def search_tracks(query: str):
    loop = asyncio.get_event_loop()

    if not query.startswith("http"):
        query = f"ytsearch:{query}"

    data = await loop.run_in_executor(
        None,
        lambda: ytdl_search.extract_info(query, download=False)
    )

    entries = data.get("entries", [data]) if "entries" in data else [data]

    return [
        {
            "title": e.get("title", "Bilinmiyor"),
            "webpage_url": e.get("webpage_url") or e.get("url", ""),
            "duration": e.get("duration"),
            "thumbnail": e.get("thumbnail", ""),
        }
        for e in entries if e
    ]

async def get_stream_url(webpage_url: str):
    loop = asyncio.get_event_loop()

    data = await loop.run_in_executor(
        None,
        lambda: ytdl_stream.extract_info(webpage_url, download=False)
    )

    return data["url"]

def duration_str(seconds):
    if not seconds:
        return "?"

    seconds = int(seconds)

    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)

    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"

# ─── Play Engine ─────────────────────────────────────────────────────────
async def play_next(guild, vc, channel=None):
    state = get_state(guild.id)

    if state.loop and state.current:
        next_track = dict(state.current)

    elif state.queue:
        next_track = state.queue.popleft()

    else:
        state.current = None
        return

    state.current = next_track

    try:
        stream_url = await get_stream_url(next_track["webpage_url"])

        source = discord.FFmpegPCMAudio(
            stream_url,
            executable=FFMPEG_EXECUTABLE,
            **FFMPEG_OPTIONS
        )

        source = discord.PCMVolumeTransformer(
            source,
            volume=state.volume
        )

    except Exception as e:
        print(f"HATA: {e}")

        if state.queue:
            await play_next(guild, vc, channel)

        return

    def after_playing(error):
        if error:
            print(error)

        asyncio.run_coroutine_threadsafe(
            play_next(guild, vc, channel),
            bot.loop
        )

    vc.play(source, after=after_playing)

    if channel:
        embed = discord.Embed(
            title="🎵 Şu An Çalıyor",
            description=f"[{next_track['title']}]({next_track['webpage_url']})",
            color=0x5865F2
        )

        embed.add_field(
            name="⏱ Süre",
            value=duration_str(next_track["duration"])
        )

        embed.add_field(
            name="📋 Kuyruk",
            value=str(len(state.queue))
        )

        if next_track.get("thumbnail"):
            embed.set_thumbnail(url=next_track["thumbnail"])

        await channel.send(embed=embed)

@bot.event
async def on_ready():
    print(f"✅ Bot hazır: {bot.user}")

    await bot.change_presence(
        activity=discord.Activity(
            type=discord.ActivityType.listening,
            name="!play"
        )
    )

@bot.command(name="play", aliases=["p"])
async def play(ctx, *, query: str):

    if not ctx.author.voice:
        return await ctx.send("❌ Ses kanalına gir.")

    vc = ctx.voice_client

    if not vc:
        vc = await ctx.author.voice.channel.connect()

    elif vc.channel != ctx.author.voice.channel:
        await vc.move_to(ctx.author.voice.channel)

    state = get_state(ctx.guild.id)

    msg = await ctx.send("🔍 Aranıyor...")

    try:
        tracks = await search_tracks(query)

    except Exception as e:
        return await msg.edit(content=f"❌ Hata:\\n{e}")

    if not tracks:
        return await msg.edit(content="❌ Sonuç bulunamadı.")

    for t in tracks:
        state.queue.append(t)

    await msg.edit(content=f"✅ {len(tracks)} şarkı kuyruğa eklendi.")

    if not vc.is_playing() and not vc.is_paused():
        await play_next(ctx.guild, vc, ctx.channel)

@bot.command(name="skip")
async def skip(ctx):
    vc = ctx.voice_client

    if vc and vc.is_playing():
        vc.stop()
        await ctx.message.add_reaction("⏭")

@bot.command(name="pause")
async def pause(ctx):
    vc = ctx.voice_client

    if vc and vc.is_playing():
        vc.pause()
        await ctx.message.add_reaction("⏸")

@bot.command(name="resume")
async def resume(ctx):
    vc = ctx.voice_client

    if vc and vc.is_paused():
        vc.resume()
        await ctx.message.add_reaction("▶")

@bot.command(name="stop")
async def stop(ctx):
    state = get_state(ctx.guild.id)

    state.queue.clear()
    state.current = None

    vc = ctx.voice_client

    if vc:
        vc.stop()

    await ctx.message.add_reaction("⏹")

@bot.command(name="leave")
async def leave(ctx):
    state = get_state(ctx.guild.id)
    state.queue.clear()
    state.current = None

    vc = ctx.voice_client

    if vc:
        await vc.disconnect()

    await ctx.message.add_reaction("👋")

if __name__ == "__main__":
    if not TOKEN:
        print("DISCORD_TOKEN yok.")
        exit(1)

    bot.run(TOKEN)
