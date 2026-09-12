from __future__ import annotations

import asyncio
import json
import os
from typing import Any

import discord
import requests
from discord import app_commands


REQUEST_TIMEOUT = (5, 90)
DISCORD_MESSAGE_LIMIT = 1900


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def markdown_value(value: Any, depth: int = 0) -> str:
    if value is None:
        return "-"
    if isinstance(value, bool):
        return "ใช่" if value else "ไม่"
    if isinstance(value, (str, int, float)):
        return str(value)
    if isinstance(value, list):
        if not value:
            return "-"
        return "\n".join(f"- {markdown_value(item, depth + 1)}" for item in value)
    if isinstance(value, dict):
        lines: list[str] = []
        for key, item in value.items():
            label = str(key).replace("_", " ").strip().title()
            rendered = markdown_value(item, depth + 1)
            if isinstance(item, (dict, list)):
                lines.append(f"**{label}**\n{rendered}")
            else:
                lines.append(f"**{label}:** {rendered}")
        return "\n".join(lines)
    return json.dumps(value, ensure_ascii=False, default=str)


def split_message(text: str, limit: int = DISCORD_MESSAGE_LIMIT) -> list[str]:
    remaining = text.strip() or "ไม่มีข้อมูล"
    chunks: list[str] = []
    while len(remaining) > limit:
        cut = remaining.rfind("\n", 0, limit)
        if cut < limit // 2:
            cut = limit
        chunks.append(remaining[:cut].strip())
        remaining = remaining[cut:].strip()
    if remaining:
        chunks.append(remaining)
    return chunks


class HermesApi:
    def __init__(self) -> None:
        self.base_url = required_env("API_BASE_URL").rstrip("/")
        self.token = required_env("INTERNAL_API_TOKEN")

    def call(
        self,
        method: str,
        path: str,
        discord_user_id: int,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        response = requests.request(
            method,
            f"{self.base_url}{path}",
            headers={
                "Authorization": f"Bearer {self.token}",
                "X-Discord-User-ID": str(discord_user_id),
            },
            json=payload,
            timeout=REQUEST_TIMEOUT,
        )
        if response.status_code >= 400:
            try:
                detail = response.json().get("detail", "API request failed")
            except ValueError:
                detail = "API request failed"
            raise RuntimeError(f"{detail} (HTTP {response.status_code})")
        return response.json()


class HermesDiscord(discord.Client):
    def __init__(self) -> None:
        super().__init__(intents=discord.Intents.none())
        self.tree = app_commands.CommandTree(self)
        self.owner_id = int(required_env("DISCORD_OWNER_USER_ID"))
        self.guild_id = os.getenv("DISCORD_GUILD_ID", "").strip()
        self.api = HermesApi()

    async def setup_hook(self) -> None:
        if self.guild_id:
            guild = discord.Object(id=int(self.guild_id))
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
            print(f"Hermes commands synced to guild {self.guild_id}.")
        else:
            await self.tree.sync()
            print("Hermes global commands synced; Discord may take up to one hour to display them.")

    async def on_ready(self) -> None:
        print(f"Hermes connected as {self.user}.")

    async def execute(
        self,
        interaction: discord.Interaction,
        method: str,
        path: str,
        payload: dict[str, Any] | None = None,
    ) -> None:
        if interaction.user.id != self.owner_id:
            await interaction.response.send_message("คำสั่งนี้อนุญาตเฉพาะเจ้าของระบบ", ephemeral=True)
            return
        await interaction.response.defer(thinking=True, ephemeral=False)
        try:
            result = await asyncio.to_thread(self.api.call, method, path, interaction.user.id, payload)
            body = result.get("result", result)
            messages = split_message(markdown_value(body))
            await interaction.followup.send(messages[0])
            for message in messages[1:]:
                await interaction.followup.send(message)
        except Exception as exc:
            await interaction.followup.send(f"Hermes ทำงานไม่สำเร็จ: {exc}", ephemeral=True)


def create_client() -> HermesDiscord:
    client = HermesDiscord()

    @client.tree.command(name="ask", description="สั่งงาน Hermes Lead Agent")
    @app_commands.describe(command="งานหรือคำถามที่ต้องการให้ Hermes จัดเส้นทาง")
    async def ask(interaction: discord.Interaction, command: str) -> None:
        await client.execute(interaction, "POST", "/v1/agent/dispatch", {"command": command})

    @client.tree.command(name="portfolio", description="ดูบริบทพอร์ตปัจจุบัน")
    async def portfolio(interaction: discord.Interaction) -> None:
        await client.execute(interaction, "GET", "/v1/portfolio/context")

    @client.tree.command(name="research", description="ให้ Research Agent วิจัยหุ้น")
    @app_commands.describe(ticker="Ticker เช่น GOOGL.US", question="คำถามเพิ่มเติม")
    async def research(interaction: discord.Interaction, ticker: str, question: str = "") -> None:
        await client.execute(interaction, "POST", "/v1/research", {"ticker": ticker.upper(), "question": question})

    @client.tree.command(name="discover", description="ให้ Discovery Agent ค้นหุ้นตามเงื่อนไข")
    @app_commands.describe(criteria="Theme, sector หรือเงื่อนไข", limit="จำนวน candidate 1-10")
    async def discover(interaction: discord.Interaction, criteria: str, limit: app_commands.Range[int, 1, 10] = 5) -> None:
        await client.execute(interaction, "POST", "/v1/discover", {"criteria": criteria, "limit": limit})

    watch = app_commands.Group(name="watch", description="จัดการ Watchlist")

    @watch.command(name="add", description="เพิ่มหุ้นเข้า Watchlist")
    @app_commands.describe(ticker="Ticker เช่น PLTR.US", reason="เหตุผลที่ต้องการติดตาม")
    async def watch_add(interaction: discord.Interaction, ticker: str, reason: str = "") -> None:
        await client.execute(interaction, "POST", "/v1/watchlist", {"ticker": ticker.upper(), "reason": reason, "status": "not_started"})

    @watch.command(name="remove", description="ลบหุ้นออกจาก Watchlist")
    async def watch_remove(interaction: discord.Interaction, ticker: str) -> None:
        await client.execute(interaction, "DELETE", f"/v1/watchlist/{ticker.upper()}")

    client.tree.add_command(watch)

    @client.tree.command(name="brief", description="อ่านรายงานพอร์ตล่าสุด")
    async def brief(interaction: discord.Interaction) -> None:
        await client.execute(interaction, "GET", "/v1/briefings/latest")

    alerts = app_commands.Group(name="alerts", description="ตรวจสถานะแจ้งเตือน")

    @alerts.command(name="status", description="ดูสถานะแจ้งเตือนล่าสุด")
    async def alerts_status(interaction: discord.Interaction) -> None:
        await client.execute(interaction, "GET", "/v1/alerts/status")

    client.tree.add_command(alerts)
    return client


def main() -> None:
    client = create_client()
    client.run(required_env("DISCORD_BOT_TOKEN"), log_handler=None)


if __name__ == "__main__":
    main()
