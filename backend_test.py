#!/usr/bin/env python3
"""
Backend test for: Visibilidad de trabajadores creados por usuario de mandante sin asignación (creado_por)
Tests the fix that allows mandante users to see workers they created even without assignments.
"""

import asyncio
import aiohttp
import json
import sys
from datetime import datetime

# Base URL from .env
BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"

# Test credentials
CREDENTIALS = {
    "pmiranda": {"email": "pmiranda@rioloa.cl", "password": "Aptiva2025!"},
    "crivera": {"email": "crivera@rioloa.cl", "password": "Aptiva2025!"},
    "admin": {"email": "admin@aptivarl.com", "password": "Aptiva2025!"}
}

# Test data
MILTON_RUT = "25.959.268-2"  # Worker backfilled with creado_por = pmiranda

class TestRunner:
    def __init__(self):
        self.tokens = {}
        self.test_trabajador_id = None
        self.test_rut = None
        self.empresa_id = None
        
    async def login(self, session, user_key):
        """Login and store token"""
        try:
            creds = CREDENTIALS[user_key]
            print(f"\n{'='*80}")
            print(f"LOGIN: {creds['email']}")
            print(f"{'='*80}")
            
            async with session.post(
                f"{BASE_URL}/auth/login",
                json={"email": creds["email"], "password": creds["password"]},
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                status = resp.status
                data = await resp.json()
                
                if status == 200 and data.get("token"):
                    self.tokens[user_key] = data["token"]
                    profile = data.get("profile", {})
                    print(f"✅ LOGIN SUCCESS: {creds['email']}")
                    print(f"   Role: {profile.get('role_codigo')}")
                    print(f"   Auth User ID: {profile.get('auth_user_id')}")
                    if profile.get('is_mandante'):
                        print(f"   Mandante IDs: {profile.get('mandante_ids', [])}")
                    return True
                else:
                    print(f"❌ LOGIN FAILED: {creds['email']} - Status {status}")
                    print(f"   Response: {data}")
                    return False
        except Exception as e:
            print(f"❌ LOGIN ERROR: {creds['email']} - {str(e)}")
            return False
    
    def get_headers(self, user_key):
        """Get authorization headers for user"""
        token = self.tokens.get(user_key)
        if not token:
            return {}
        return {"Authorization": f"Bearer {token}"}
    
    async def test_1_milton_visible_to_pmiranda(self, session):
        """TEST 1: pmiranda should see Milton (RUT 25.959.268-2) even without assignments"""
        print(f"\n{'='*80}")
        print(f"TEST 1: Milton visible to pmiranda (backfilled creado_por)")
        print(f"{'='*80}")
        
        try:
            headers = self.get_headers("pmiranda")
            async with session.get(
                f"{BASE_URL}/trabajadores?q={MILTON_RUT}",
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                status = resp.status
                data = await resp.json()
                
                print(f"GET /api/trabajadores?q={MILTON_RUT}")
                print(f"Status: {status}")
                
                if status == 200:
                    trabajadores = data.get("trabajadores", [])
                    print(f"Found {len(trabajadores)} trabajador(es)")
                    
                    milton = None
                    for t in trabajadores:
                        if t.get("rut") == MILTON_RUT:
                            milton = t
                            break
                    
                    if milton:
                        print(f"✅ TEST 1 PASSED: Milton found in results")
                        print(f"   Trabajador ID: {milton.get('trabajador_id')}")
                        print(f"   Nombre: {milton.get('nombre')} {milton.get('apellido')}")
                        print(f"   RUT: {milton.get('rut')}")
                        print(f"   Vinculado: {milton.get('vinculado')}")
                        return True
                    else:
                        print(f"❌ TEST 1 FAILED: Milton NOT found in results")
                        print(f"   Expected RUT: {MILTON_RUT}")
                        print(f"   Results: {trabajadores}")
                        return False
                else:
                    print(f"❌ TEST 1 FAILED: Status {status}")
                    print(f"   Response: {data}")
                    return False
        except Exception as e:
            print(f"❌ TEST 1 ERROR: {str(e)}")
            return False
    
    async def test_2_create_worker_without_assignment(self, session):
        """TEST 2: Create new worker as pmiranda WITHOUT assignment"""
        print(f"\n{'='*80}")
        print(f"TEST 2: Create worker as pmiranda WITHOUT assignment")
        print(f"{'='*80}")
        
        try:
            # First get an empresa_id
            headers = self.get_headers("pmiranda")
            async with session.get(
                f"{BASE_URL}/empresas",
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    empresas = data.get("empresas", [])
                    if empresas:
                        self.empresa_id = empresas[0]["empresa_id"]
                        print(f"Selected empresa: {empresas[0].get('razon_social')} ({self.empresa_id})")
                    else:
                        print(f"❌ TEST 2 FAILED: No empresas found")
                        return False
                else:
                    print(f"❌ TEST 2 FAILED: Could not get empresas - Status {resp.status}")
                    return False
            
            # Generate a unique Chilean RUT
            import random
            base_rut = random.randint(20000000, 25000000)
            
            # Calculate Chilean RUT verification digit
            def calculate_dv(rut_num):
                reversed_digits = str(rut_num)[::-1]
                factors = [2, 3, 4, 5, 6, 7]
                s = sum(int(d) * factors[i % 6] for i, d in enumerate(reversed_digits))
                remainder = s % 11
                dv = 11 - remainder
                if dv == 11:
                    return '0'
                elif dv == 10:
                    return 'K'
                else:
                    return str(dv)
            
            dv = calculate_dv(base_rut)
            self.test_rut = f"{base_rut}-{dv}"
            formatted_rut = f"{str(base_rut)[:-6]}.{str(base_rut)[-6:-3]}.{str(base_rut)[-3:]}-{dv}"
            
            print(f"Generated RUT: {formatted_rut}")
            
            # Create trabajador
            worker_data = {
                "empresa_id": self.empresa_id,
                "rut": formatted_rut,
                "nombre": "Test",
                "apellido": "Worker CreadorPor",
                "cargo": "QA Test Worker",
                "genero": "M"
            }
            
            async with session.post(
                f"{BASE_URL}/trabajadores",
                headers=headers,
                json=worker_data,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                status = resp.status
                data = await resp.json()
                
                print(f"POST /api/trabajadores")
                print(f"Status: {status}")
                
                if status == 201:
                    trabajador = data.get("trabajador", {})
                    self.test_trabajador_id = trabajador.get("trabajador_id")
                    print(f"✅ Worker created successfully")
                    print(f"   Trabajador ID: {self.test_trabajador_id}")
                    print(f"   RUT: {trabajador.get('rut')}")
                    print(f"   Nombre: {trabajador.get('nombre')} {trabajador.get('apellido')}")
                    
                    # Now verify it appears in the list
                    await asyncio.sleep(1)  # Brief pause
                    
                    async with session.get(
                        f"{BASE_URL}/trabajadores?q={self.test_rut}",
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=30)
                    ) as resp2:
                        status2 = resp2.status
                        data2 = await resp2.json()
                        
                        print(f"\nGET /api/trabajadores?q={self.test_rut}")
                        print(f"Status: {status2}")
                        
                        if status2 == 200:
                            trabajadores = data2.get("trabajadores", [])
                            found = any(t.get("trabajador_id") == self.test_trabajador_id for t in trabajadores)
                            
                            if found:
                                print(f"✅ TEST 2 PASSED: New worker visible to pmiranda (creator)")
                                print(f"   Worker appears in list even WITHOUT assignment")
                                print(f"   This confirms creado_por logic is working")
                                return True
                            else:
                                print(f"❌ TEST 2 FAILED: New worker NOT visible to pmiranda")
                                print(f"   Expected trabajador_id: {self.test_trabajador_id}")
                                print(f"   Results: {trabajadores}")
                                return False
                        else:
                            print(f"❌ TEST 2 FAILED: Could not query trabajadores - Status {status2}")
                            return False
                else:
                    print(f"❌ TEST 2 FAILED: Could not create worker - Status {status}")
                    print(f"   Response: {data}")
                    return False
        except Exception as e:
            print(f"❌ TEST 2 ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    async def test_3_isolation_crivera_cannot_see(self, session):
        """TEST 3: crivera (different RRHH user) should NOT see pmiranda's unassigned worker"""
        print(f"\n{'='*80}")
        print(f"TEST 3: Isolation - crivera cannot see pmiranda's unassigned worker")
        print(f"{'='*80}")
        
        if not self.test_rut or not self.test_trabajador_id:
            print(f"⚠️ TEST 3 SKIPPED: No test worker created in TEST 2")
            return False
        
        try:
            headers = self.get_headers("crivera")
            async with session.get(
                f"{BASE_URL}/trabajadores?q={self.test_rut}",
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                status = resp.status
                data = await resp.json()
                
                print(f"GET /api/trabajadores?q={self.test_rut} (as crivera)")
                print(f"Status: {status}")
                
                if status == 200:
                    trabajadores = data.get("trabajadores", [])
                    found = any(t.get("trabajador_id") == self.test_trabajador_id for t in trabajadores)
                    
                    if not found:
                        print(f"✅ TEST 3 PASSED: crivera CANNOT see pmiranda's unassigned worker")
                        print(f"   Isolation working correctly")
                        print(f"   Worker only visible to creator (pmiranda)")
                        return True
                    else:
                        print(f"❌ TEST 3 FAILED: crivera CAN see pmiranda's unassigned worker")
                        print(f"   This is a security issue - isolation not working")
                        print(f"   Found: {[t for t in trabajadores if t.get('trabajador_id') == self.test_trabajador_id]}")
                        return False
                else:
                    print(f"❌ TEST 3 FAILED: Status {status}")
                    print(f"   Response: {data}")
                    return False
        except Exception as e:
            print(f"❌ TEST 3 ERROR: {str(e)}")
            return False
    
    async def test_4_admin_sees_all(self, session):
        """TEST 4: Holding admin should see ALL workers including unassigned ones"""
        print(f"\n{'='*80}")
        print(f"TEST 4: Holding admin sees all workers")
        print(f"{'='*80}")
        
        try:
            headers = self.get_headers("admin")
            
            # Test 4a: Admin sees Milton
            async with session.get(
                f"{BASE_URL}/trabajadores?q={MILTON_RUT}",
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                status = resp.status
                data = await resp.json()
                
                print(f"GET /api/trabajadores?q={MILTON_RUT} (as admin)")
                print(f"Status: {status}")
                
                milton_found = False
                if status == 200:
                    trabajadores = data.get("trabajadores", [])
                    milton_found = any(t.get("rut") == MILTON_RUT for t in trabajadores)
                    
                    if milton_found:
                        print(f"✅ Admin can see Milton (RUT {MILTON_RUT})")
                    else:
                        print(f"❌ Admin CANNOT see Milton")
            
            # Test 4b: Admin sees test worker created by pmiranda
            if self.test_rut and self.test_trabajador_id:
                async with session.get(
                    f"{BASE_URL}/trabajadores?q={self.test_rut}",
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as resp:
                    status = resp.status
                    data = await resp.json()
                    
                    print(f"\nGET /api/trabajadores?q={self.test_rut} (as admin)")
                    print(f"Status: {status}")
                    
                    test_worker_found = False
                    if status == 200:
                        trabajadores = data.get("trabajadores", [])
                        test_worker_found = any(t.get("trabajador_id") == self.test_trabajador_id for t in trabajadores)
                        
                        if test_worker_found:
                            print(f"✅ Admin can see test worker created by pmiranda")
                        else:
                            print(f"❌ Admin CANNOT see test worker")
                
                if milton_found and test_worker_found:
                    print(f"\n✅ TEST 4 PASSED: Admin sees all workers (no scope restriction)")
                    return True
                else:
                    print(f"\n❌ TEST 4 FAILED: Admin missing some workers")
                    return False
            else:
                if milton_found:
                    print(f"\n✅ TEST 4 PASSED: Admin sees Milton (test worker not created)")
                    return True
                else:
                    print(f"\n❌ TEST 4 FAILED: Admin cannot see Milton")
                    return False
        except Exception as e:
            print(f"❌ TEST 4 ERROR: {str(e)}")
            return False
    
    async def test_5_regression_list_all(self, session):
        """TEST 5: Regression - GET /api/trabajadores without filters should return 200"""
        print(f"\n{'='*80}")
        print(f"TEST 5: Regression - List all trabajadores")
        print(f"{'='*80}")
        
        try:
            headers = self.get_headers("pmiranda")
            async with session.get(
                f"{BASE_URL}/trabajadores",
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                status = resp.status
                data = await resp.json()
                
                print(f"GET /api/trabajadores (no filters, as pmiranda)")
                print(f"Status: {status}")
                
                if status == 200:
                    trabajadores = data.get("trabajadores", [])
                    print(f"✅ TEST 5 PASSED: List endpoint returns 200")
                    print(f"   Returned {len(trabajadores)} trabajadores")
                    print(f"   No 500 errors")
                    return True
                else:
                    print(f"❌ TEST 5 FAILED: Status {status}")
                    print(f"   Response: {data}")
                    return False
        except Exception as e:
            print(f"❌ TEST 5 ERROR: {str(e)}")
            return False
    
    async def cleanup(self, session):
        """CLEANUP: Delete test worker created in TEST 2"""
        print(f"\n{'='*80}")
        print(f"CLEANUP: Delete test worker")
        print(f"{'='*80}")
        
        if not self.test_trabajador_id:
            print(f"⚠️ CLEANUP SKIPPED: No test worker to delete")
            return True
        
        try:
            headers = self.get_headers("admin")
            async with session.delete(
                f"{BASE_URL}/trabajadores/{self.test_trabajador_id}",
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                status = resp.status
                
                print(f"DELETE /api/trabajadores/{self.test_trabajador_id}")
                print(f"Status: {status}")
                
                if status == 200:
                    print(f"✅ CLEANUP SUCCESS: Test worker deleted")
                    return True
                else:
                    data = await resp.json()
                    print(f"⚠️ CLEANUP WARNING: Could not delete test worker - Status {status}")
                    print(f"   Response: {data}")
                    print(f"   Manual cleanup may be required")
                    return False
        except Exception as e:
            print(f"⚠️ CLEANUP ERROR: {str(e)}")
            print(f"   Manual cleanup may be required for trabajador_id: {self.test_trabajador_id}")
            return False
    
    async def run_all_tests(self):
        """Run all tests in sequence"""
        print(f"\n{'#'*80}")
        print(f"# BACKEND TEST: Visibilidad trabajadores creados por usuario mandante")
        print(f"# Feature: creado_por column + visibility logic")
        print(f"{'#'*80}")
        
        results = {}
        
        async with aiohttp.ClientSession() as session:
            # Login all users
            print(f"\n{'='*80}")
            print(f"PHASE 1: LOGIN ALL USERS")
            print(f"{'='*80}")
            
            login_success = True
            for user_key in ["pmiranda", "crivera", "admin"]:
                if not await self.login(session, user_key):
                    login_success = False
            
            if not login_success:
                print(f"\n❌ CRITICAL: Login failed for one or more users")
                return False
            
            # Run tests
            print(f"\n{'='*80}")
            print(f"PHASE 2: RUN TESTS")
            print(f"{'='*80}")
            
            results["test_1"] = await self.test_1_milton_visible_to_pmiranda(session)
            results["test_2"] = await self.test_2_create_worker_without_assignment(session)
            results["test_3"] = await self.test_3_isolation_crivera_cannot_see(session)
            results["test_4"] = await self.test_4_admin_sees_all(session)
            results["test_5"] = await self.test_5_regression_list_all(session)
            
            # Cleanup
            print(f"\n{'='*80}")
            print(f"PHASE 3: CLEANUP")
            print(f"{'='*80}")
            
            await self.cleanup(session)
        
        # Summary
        print(f"\n{'#'*80}")
        print(f"# TEST SUMMARY")
        print(f"{'#'*80}")
        
        passed = sum(1 for v in results.values() if v)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            print(f"{status}: {test_name}")
        
        print(f"\n{'='*80}")
        print(f"TOTAL: {passed}/{total} tests passed")
        print(f"{'='*80}")
        
        return passed == total

async def main():
    runner = TestRunner()
    success = await runner.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())
