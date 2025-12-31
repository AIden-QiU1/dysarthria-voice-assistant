"""
Integration Test for VoxFlame MVP
Tests: Backend → TEN Agent HTTP API → SQLite
"""
import asyncio
import aiohttp
import json

BACKEND_URL = "http://localhost:3001"
TEN_AGENT_URL = "http://localhost:8080"

async def test_health_checks():
    """Step 1: Health checks"""
    print("\n=== Step 1: Health Checks ===")
    
    async with aiohttp.ClientSession() as session:
        # TEN Agent health
        try:
            async with session.get(f"{TEN_AGENT_URL}/health") as resp:
                data = await resp.json()
                print(f"✅ TEN Agent: {data}")
        except Exception as e:
            print(f"❌ TEN Agent unreachable: {e}")
            return False
        
        # Backend health
        try:
            async with session.get(f"{BACKEND_URL}/health") as resp:
                data = await resp.json()
                print(f"✅ Backend: {data}")
        except Exception as e:
            print(f"❌ Backend unreachable: {e}")
            return False
    
    return True

async def test_session_lifecycle():
    """Step 2: Session lifecycle (start → stop)"""
    print("\n=== Step 2: Session Lifecycle ===")
    
    async with aiohttp.ClientSession() as session:
        # Start session
        try:
            async with session.post(
                f"{BACKEND_URL}/api/session/start",
                json={"userId": "test_user_001", "hotwords": ["你好", "测试"]}
            ) as resp:
                if resp.status != 200:
                    print(f"❌ Start session failed: HTTP {resp.status}")
                    return False
                
                data = await resp.json()
                session_id = data.get("sessionId")
                print(f"✅ Session started: {session_id}")
                print(f"   WebSocket URL: {data.get('websocketUrl')}")
        except Exception as e:
            print(f"❌ Start session error: {e}")
            return False
        
        # Wait a bit
        await asyncio.sleep(1)
        
        # Stop session
        try:
            async with session.post(
                f"{BACKEND_URL}/api/session/stop",
                json={"sessionId": session_id}
            ) as resp:
                data = await resp.json()
                print(f"✅ Session stopped: {data}")
        except Exception as e:
            print(f"❌ Stop session error: {e}")
            return False
    
    return True

async def test_hotwords_reload():
    """Step 3: Hotwords reload"""
    print("\n=== Step 3: Hotwords Reload ===")
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(
                f"{BACKEND_URL}/api/session/reload-hotwords",
                json={"userId": "test_user_001", "hotwords": ["新词1", "新词2"]}
            ) as resp:
                data = await resp.json()
                if data.get("success"):
                    print(f"✅ Hotwords reloaded")
                else:
                    print(f"❌ Hotwords reload failed")
                    return False
        except Exception as e:
            print(f"❌ Reload hotwords error: {e}")
            return False
    
    return True

async def main():
    print("=" * 60)
    print("VoxFlame MVP Integration Test")
    print("=" * 60)
    
    # Run tests
    results = []
    
    health_ok = await test_health_checks()
    results.append(("Health Checks", health_ok))
    
    if health_ok:
        session_ok = await test_session_lifecycle()
        results.append(("Session Lifecycle", session_ok))
        
        hotwords_ok = await test_hotwords_reload()
        results.append(("Hotwords Reload", hotwords_ok))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")
    
    all_passed = all(r[1] for r in results)
    if all_passed:
        print("\n🎉 All tests passed!")
    else:
        print("\n⚠️  Some tests failed")
    
    return all_passed

if __name__ == "__main__":
    asyncio.run(main())
