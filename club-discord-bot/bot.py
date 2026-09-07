import os
import discord
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

TOKEN = os.getenv('DISCORD_BOT_TOKEN')
CHANNEL_ID = int(os.getenv('ANNOUNCEMENTS_CHANNEL_ID'))
EDGE_FUNCTION_URL = os.getenv('SUPABASE_EDGE_FUNCTION_URL')

# Set up Discord Intents (Required to read message content)
intents = discord.Intents.default()
intents.message_content = True

client = discord.Client(intents=intents)

def get_headers():
    """Headers required to authenticate with your Supabase Edge Function"""
    return {
        "Authorization": TOKEN,
        "Content-Type": "application/json"
    }

@client.event
async def on_ready():
    print(f'✅ Logged in as {client.user}')
    print(f'📡 Listening to channel ID: {CHANNEL_ID}')

@client.event
async def on_message(message):
    # Ignore messages sent by the bot itself
    if message.author == client.user:
        return

    # Only process messages in the specific announcements channel
    if message.channel.id == CHANNEL_ID:
        print(f"New message detected from {message.author.display_name}")
        
        payload = {
            "content": message.content,
            "author": message.author.display_name,
            "discord_message_id": str(message.id)
        }
        
        try:
            response = requests.post(EDGE_FUNCTION_URL, json=payload, headers=get_headers())
            if response.status_code == 200:
                print(f"✅ Successfully synced message {message.id} to website.")
            else:
                print(f"❌ Failed to sync message. Status: {response.status_code}, Error: {response.text}")
        except Exception as e:
            print(f"⚠️ Error connecting to Edge Function: {e}")

@client.event
async def on_message_delete(message):
    # Only process deletions in the specific announcements channel
    if message.channel.id == CHANNEL_ID:
        print(f"Message deletion detected (ID: {message.id})")
        
        payload = {
            "discord_message_id": str(message.id)
        }
        
        try:
            response = requests.delete(EDGE_FUNCTION_URL, json=payload, headers=get_headers())
            if response.status_code == 200:
                print(f"✅ Successfully deleted message {message.id} from website.")
            else:
                print(f"❌ Failed to delete message. Status: {response.status_code}, Error: {response.text}")
        except Exception as e:
            print(f"⚠️ Error connecting to Edge Function: {e}")

# Start the bot
if __name__ == "__main__":
    if not TOKEN or not EDGE_FUNCTION_URL or not CHANNEL_ID:
        print("❌ Missing environment variables. Please check your .env file.")
    else:
        client.run(TOKEN)