#!/usr/bin/env python3
"""
Backend API Testing for Aptiva RL - Email Notifications Feature
Tests the NEW "Notificación de vencimientos por correo" backend
"""

import requests
import json
import sys
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/.env')

# Read base URL from .env
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://aptiva-db.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin@aptivarl.com"
ADMIN_PASSWORD = "Aptiva2025!"

# Safe test recipient (throwaway email)
TEST_EMAIL = "delivered@resend.dev"

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def log_test(test_name, status, message=""):
    """Log test result with color"""
    color = GREEN if status == "PASS" else RED if status == "FAIL" else YELLOW
    print(f"{color}[{status}]{RESET} {test_name}")
    if message:
        print(f"      {message}")

def login(email, password):
    """Login and return token"""
    try:
        response = requests.post(
            f"{API_URL}/auth/login",
            json={"email": email, "password": password},
            timeout=30
        )
        if response.status_code == 200:
            data = response.json()
            return data.get('token')
        else:
            print(f"{RED}Login failed: {response.status_code} - {response.text[:200]}{RESET}")
            return None
    except Exception as e:
        print(f"{RED}Login error: {str(e)}{RESET}")
        return None

def test_1_admin_login():
    """TEST 1: Login admin -> 200 token"""
    print(f"\n{BLUE}=== TEST 1: Admin Login ==={RESET}")
    token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if token:
        log_test("Admin login", "PASS", f"Token received (length: {len(token)})")
        return token
    else:
        log_test("Admin login", "FAIL", "No token received")
        return None

def test_2_get_usuarios(token):
    """TEST 2: GET /api/usuarios -> 200, verify notificar_email field"""
    print(f"\n{BLUE}=== TEST 2: GET /api/usuarios (verify notificar_email field) ==={RESET}")
    try:
        response = requests.get(
            f"{API_URL}/usuarios",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("GET /api/usuarios", "FAIL", f"Status: {response.status_code}")
            return None, None
        
        data = response.json()
        usuarios = data.get('usuarios', [])
        mandantesAll = data.get('mandantesAll', [])
        
        if not usuarios:
            log_test("GET /api/usuarios", "FAIL", "No usuarios returned")
            return None, None
        
        # Verify every usuario has notificar_email field
        all_have_field = all('notificar_email' in u for u in usuarios)
        
        if all_have_field:
            log_test("GET /api/usuarios", "PASS", f"All {len(usuarios)} usuarios have notificar_email field")
            log_test("notificar_email field", "PASS", f"Field is boolean: {type(usuarios[0].get('notificar_email')).__name__}")
        else:
            log_test("GET /api/usuarios", "FAIL", "Some usuarios missing notificar_email field")
            return None, None
        
        log_test("mandantesAll captured", "PASS", f"Found {len(mandantesAll)} mandantes")
        
        return usuarios, mandantesAll
        
    except Exception as e:
        log_test("GET /api/usuarios", "FAIL", f"Error: {str(e)}")
        return None, None

def test_3_preview_correos(token, usuarios):
    """TEST 3: Find MANDANTE_ADMIN and call preview-correos"""
    print(f"\n{BLUE}=== TEST 3: GET /api/usuarios/:id/preview-correos ==={RESET}")
    
    # Find a MANDANTE_ADMIN with mandantes
    mandante_admin = None
    for u in usuarios:
        if u.get('role_codigo') == 'MANDANTE_ADMIN' and u.get('mandantes') and len(u.get('mandantes', [])) > 0:
            mandante_admin = u
            break
    
    if not mandante_admin:
        log_test("Find MANDANTE_ADMIN", "WARN", "No MANDANTE_ADMIN with mandantes found, skipping preview test")
        return None
    
    log_test("Find MANDANTE_ADMIN", "PASS", f"Found: {mandante_admin.get('nombre')} with {len(mandante_admin.get('mandantes', []))} mandantes")
    
    perfil_id = mandante_admin.get('perfil_id')
    
    try:
        response = requests.get(
            f"{API_URL}/usuarios/{perfil_id}/preview-correos",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("GET preview-correos", "FAIL", f"Status: {response.status_code}")
            return None
        
        data = response.json()
        
        # Verify response structure
        required_fields = ['email', 'encargado', 'notificar_email', 'email_configurado', 'total_mandantes', 'correos']
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            log_test("Preview response structure", "FAIL", f"Missing fields: {missing_fields}")
            return None
        
        log_test("Preview response structure", "PASS", "All required fields present")
        log_test("email_configurado", "PASS" if data.get('email_configurado') else "FAIL", f"Value: {data.get('email_configurado')}")
        log_test("total_mandantes", "PASS", f"Value: {data.get('total_mandantes')}")
        
        correos = data.get('correos', [])
        log_test("correos array", "PASS", f"Found {len(correos)} correos")
        
        # If correos non-empty, verify structure
        if correos:
            correo = correos[0]
            required_correo_fields = ['subject', 'count', 'rows', 'html']
            missing_correo_fields = [f for f in required_correo_fields if f not in correo]
            
            if missing_correo_fields:
                log_test("Correo structure", "FAIL", f"Missing fields: {missing_correo_fields}")
                return None
            
            log_test("Correo structure", "PASS", "All required fields present")
            
            # Verify HTML contains required headers
            html = correo.get('html', '')
            has_table = '<table' in html
            has_dias_header = 'Días Por Vencer' in html
            has_encargado_header = 'Nombre Encargado' in html
            
            log_test("HTML contains <table", "PASS" if has_table else "FAIL", f"Value: {has_table}")
            log_test("HTML contains 'Días Por Vencer'", "PASS" if has_dias_header else "FAIL", f"Value: {has_dias_header}")
            log_test("HTML contains 'Nombre Encargado'", "PASS" if has_encargado_header else "FAIL", f"Value: {has_encargado_header}")
            
            # Verify rows structure
            rows = correo.get('rows', [])
            if rows:
                row = rows[0]
                required_row_fields = ['rut', 'nombre', 'documento', 'dias_label', 'contrato', 'mandante']
                missing_row_fields = [f for f in required_row_fields if f not in row]
                
                if missing_row_fields:
                    log_test("Row structure", "FAIL", f"Missing fields: {missing_row_fields}")
                else:
                    log_test("Row structure", "PASS", "All required fields present in rows[0]")
        else:
            log_test("correos array", "WARN", "No correos (no expiring docs for this admin)")
        
        return mandante_admin
        
    except Exception as e:
        log_test("GET preview-correos", "FAIL", f"Error: {str(e)}")
        return None

def test_4_cron_auth(token):
    """TEST 4: CRON AUTH - test with/without WEBHOOK_CRON_SECRET"""
    print(f"\n{BLUE}=== TEST 4: CRON AUTH (POST /api/cron/vencimientos) ==={RESET}")
    
    # Read WEBHOOK_CRON_SECRET from environment
    webhook_secret = os.getenv('WEBHOOK_CRON_SECRET')
    
    if not webhook_secret:
        log_test("Read WEBHOOK_CRON_SECRET", "FAIL", "WEBHOOK_CRON_SECRET not found in environment")
        return False
    
    log_test("Read WEBHOOK_CRON_SECRET", "PASS", f"Secret length: {len(webhook_secret)}")
    
    # Test 4a: POST without Authorization header -> expect 401
    try:
        response = requests.post(
            f"{API_URL}/cron/vencimientos",
            json={},
            timeout=30
        )
        
        if response.status_code == 401:
            log_test("POST cron/vencimientos (no auth)", "PASS", "Got 401 as expected")
        else:
            log_test("POST cron/vencimientos (no auth)", "FAIL", f"Expected 401, got {response.status_code}")
    except Exception as e:
        log_test("POST cron/vencimientos (no auth)", "FAIL", f"Error: {str(e)}")
    
    # Test 4b: POST with correct Authorization header -> expect 202
    try:
        # Use unique webhook ID to avoid duplicate detection
        import time
        webhook_id = f"qa-test-{int(time.time() * 1000)}"
        
        response = requests.post(
            f"{API_URL}/cron/vencimientos",
            headers={
                "Authorization": f"Bearer {webhook_secret}",
                "X-Webhook-Id": webhook_id
            },
            json={},
            timeout=30
        )
        
        if response.status_code == 202:
            data = response.json()
            if data.get('ok') and data.get('accepted'):
                log_test("POST cron/vencimientos (with auth)", "PASS", f"Got 202 with ok:true, accepted:true")
            else:
                log_test("POST cron/vencimientos (with auth)", "FAIL", f"Got 202 but response: {data}")
        else:
            log_test("POST cron/vencimientos (with auth)", "FAIL", f"Expected 202, got {response.status_code}")
    except Exception as e:
        log_test("POST cron/vencimientos (with auth)", "FAIL", f"Error: {str(e)}")
    
    return True

def test_5_manual_send(token, mandantesAll):
    """TEST 5: MANUAL SEND with safe recipient (delivered@resend.dev)"""
    print(f"\n{BLUE}=== TEST 5: MANUAL SEND (create throwaway, preview, send, delete) ==={RESET}")
    
    if not mandantesAll or len(mandantesAll) == 0:
        log_test("Manual send test", "FAIL", "No mandantes available")
        return None
    
    # Find a mandante with name 'HMC Gold SCM' or use first one
    mandante = None
    for m in mandantesAll:
        if 'HMC Gold SCM' in m.get('razon_social', ''):
            mandante = m
            break
    
    if not mandante:
        mandante = mandantesAll[0]
    
    mandante_id = mandante.get('mandante_id')
    log_test("Select mandante", "PASS", f"Using: {mandante.get('razon_social')} (ID: {mandante_id})")
    
    # First, try to find and delete any existing user with TEST_EMAIL
    try:
        usuarios_response = requests.get(
            f"{API_URL}/usuarios",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        if usuarios_response.status_code == 200:
            usuarios = usuarios_response.json().get('usuarios', [])
            existing = next((u for u in usuarios if u.get('email') == TEST_EMAIL), None)
            if existing:
                existing_id = existing.get('perfil_id')
                log_test("Found existing test user", "WARN", f"Deleting existing user with perfil_id: {existing_id}")
                delete_response = requests.delete(
                    f"{API_URL}/usuarios/{existing_id}",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=30
                )
                if delete_response.status_code == 200:
                    log_test("Delete existing test user", "PASS", "Deleted successfully")
                else:
                    log_test("Delete existing test user", "WARN", f"Status: {delete_response.status_code}")
    except Exception as e:
        log_test("Cleanup existing user", "WARN", f"Error: {str(e)}")
    
    # Create throwaway user
    throwaway_data = {
        "email": TEST_EMAIL,
        "password": ADMIN_PASSWORD,
        "nombre": "QA Admin Correo",
        "role_codigo": "MANDANTE_ADMIN",
        "activo": True,
        "notificar_email": True,
        "mandantes": [mandante_id]
    }
    
    try:
        response = requests.post(
            f"{API_URL}/usuarios",
            headers={"Authorization": f"Bearer {token}"},
            json=throwaway_data,
            timeout=30
        )
        
        if response.status_code == 201:
            data = response.json()
            perfil = data.get('perfil', {})
            perfil_id = perfil.get('perfil_id')
            log_test("Create throwaway user", "PASS", f"Created with perfil_id: {perfil_id}")
        else:
            log_test("Create throwaway user", "FAIL", f"Status: {response.status_code}, Response: {response.text[:200]}")
            return None
    except Exception as e:
        log_test("Create throwaway user", "FAIL", f"Error: {str(e)}")
        return None
    
    # Get preview-correos
    try:
        response = requests.get(
            f"{API_URL}/usuarios/{perfil_id}/preview-correos",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        if response.status_code != 200:
            log_test("GET preview-correos (throwaway)", "FAIL", f"Status: {response.status_code}")
        else:
            data = response.json()
            correos = data.get('correos', [])
            log_test("GET preview-correos (throwaway)", "PASS", f"Got {len(correos)} correos")
            
            if len(correos) >= 1:
                log_test("Correos count", "PASS", f"correos.length >= 1 (has expiring docs)")
            else:
                log_test("Correos count", "WARN", f"correos.length = 0 (no expiring docs for this mandante)")
    except Exception as e:
        log_test("GET preview-correos (throwaway)", "FAIL", f"Error: {str(e)}")
    
    # Send correos
    try:
        response = requests.post(
            f"{API_URL}/usuarios/{perfil_id}/enviar-correos",
            headers={"Authorization": f"Bearer {token}"},
            json={},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            enviados = data.get('enviados', 0)
            log_test("POST enviar-correos", "PASS", f"Status 200, enviados: {enviados}")
            
            if enviados >= 1:
                log_test("Enviados count", "PASS", f"enviados >= 1")
            else:
                log_test("Enviados count", "WARN", f"enviados = 0 (no docs to send)")
        elif response.status_code == 400:
            # This is acceptable if there are no documents
            log_test("POST enviar-correos", "WARN", f"Status 400 (no documents): {response.json().get('error', '')}")
        else:
            log_test("POST enviar-correos", "FAIL", f"Status: {response.status_code}, Response: {response.text[:200]}")
    except Exception as e:
        log_test("POST enviar-correos", "FAIL", f"Error: {str(e)}")
    
    # Cleanup: Delete throwaway user
    try:
        response = requests.delete(
            f"{API_URL}/usuarios/{perfil_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        if response.status_code == 200:
            log_test("DELETE throwaway user", "PASS", "User deleted successfully")
        else:
            log_test("DELETE throwaway user", "FAIL", f"Status: {response.status_code}")
    except Exception as e:
        log_test("DELETE throwaway user", "FAIL", f"Error: {str(e)}")
    
    return perfil_id

def test_6_toggle_notificar_email(token, mandantesAll):
    """TEST 6: PUT notificar_email toggle"""
    print(f"\n{BLUE}=== TEST 6: PUT notificar_email toggle ==={RESET}")
    
    if not mandantesAll or len(mandantesAll) == 0:
        log_test("Toggle test", "FAIL", "No mandantes available")
        return
    
    mandante_id = mandantesAll[0].get('mandante_id')
    
    # First, try to find and delete any existing user with TEST_EMAIL
    try:
        usuarios_response = requests.get(
            f"{API_URL}/usuarios",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        if usuarios_response.status_code == 200:
            usuarios = usuarios_response.json().get('usuarios', [])
            existing = next((u for u in usuarios if u.get('email') == TEST_EMAIL), None)
            if existing:
                existing_id = existing.get('perfil_id')
                log_test("Found existing test user", "WARN", f"Deleting existing user with perfil_id: {existing_id}")
                delete_response = requests.delete(
                    f"{API_URL}/usuarios/{existing_id}",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=30
                )
                if delete_response.status_code == 200:
                    log_test("Delete existing test user", "PASS", "Deleted successfully")
    except Exception as e:
        log_test("Cleanup existing user", "WARN", f"Error: {str(e)}")
    
    # Create another throwaway user
    throwaway_data = {
        "email": TEST_EMAIL,
        "password": ADMIN_PASSWORD,
        "nombre": "QA Toggle Test",
        "role_codigo": "MANDANTE_ADMIN",
        "activo": True,
        "notificar_email": True,
        "mandantes": [mandante_id]
    }
    
    try:
        response = requests.post(
            f"{API_URL}/usuarios",
            headers={"Authorization": f"Bearer {token}"},
            json=throwaway_data,
            timeout=30
        )
        
        if response.status_code == 201:
            data = response.json()
            perfil = data.get('perfil', {})
            perfil_id = perfil.get('perfil_id')
            log_test("Create throwaway for toggle", "PASS", f"Created with perfil_id: {perfil_id}")
        else:
            log_test("Create throwaway for toggle", "FAIL", f"Status: {response.status_code}")
            return
    except Exception as e:
        log_test("Create throwaway for toggle", "FAIL", f"Error: {str(e)}")
        return
    
    # Toggle notificar_email to false
    try:
        response = requests.put(
            f"{API_URL}/usuarios/{perfil_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"notificar_email": False},
            timeout=30
        )
        
        if response.status_code == 200:
            log_test("PUT notificar_email=false", "PASS", "Status 200")
        else:
            log_test("PUT notificar_email=false", "FAIL", f"Status: {response.status_code}")
    except Exception as e:
        log_test("PUT notificar_email=false", "FAIL", f"Error: {str(e)}")
    
    # Verify change
    try:
        response = requests.get(
            f"{API_URL}/usuarios",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        if response.status_code == 200:
            usuarios = response.json().get('usuarios', [])
            user = next((u for u in usuarios if u.get('perfil_id') == perfil_id), None)
            
            if user and user.get('notificar_email') == False:
                log_test("Verify notificar_email=false", "PASS", "Field is now false")
            else:
                log_test("Verify notificar_email=false", "FAIL", f"Field value: {user.get('notificar_email') if user else 'user not found'}")
        else:
            log_test("Verify notificar_email=false", "FAIL", f"Status: {response.status_code}")
    except Exception as e:
        log_test("Verify notificar_email=false", "FAIL", f"Error: {str(e)}")
    
    # Toggle back to true
    try:
        response = requests.put(
            f"{API_URL}/usuarios/{perfil_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"notificar_email": True},
            timeout=30
        )
        
        if response.status_code == 200:
            log_test("PUT notificar_email=true", "PASS", "Status 200")
        else:
            log_test("PUT notificar_email=true", "FAIL", f"Status: {response.status_code}")
    except Exception as e:
        log_test("PUT notificar_email=true", "FAIL", f"Error: {str(e)}")
    
    # Cleanup
    try:
        response = requests.delete(
            f"{API_URL}/usuarios/{perfil_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30
        )
        
        if response.status_code == 200:
            log_test("DELETE toggle test user", "PASS", "User deleted successfully")
        else:
            log_test("DELETE toggle test user", "FAIL", f"Status: {response.status_code}")
    except Exception as e:
        log_test("DELETE toggle test user", "FAIL", f"Error: {str(e)}")

def test_7_authorization():
    """TEST 7: Authorization - preview-correos and enviar-correos without token"""
    print(f"\n{BLUE}=== TEST 7: Authorization (no token) ==={RESET}")
    
    fake_id = "00000000-0000-0000-0000-000000000000"
    
    # Test preview-correos without token
    try:
        response = requests.get(
            f"{API_URL}/usuarios/{fake_id}/preview-correos",
            timeout=30
        )
        
        if response.status_code == 401:
            log_test("GET preview-correos (no token)", "PASS", "Got 401 as expected")
        else:
            log_test("GET preview-correos (no token)", "FAIL", f"Expected 401, got {response.status_code}")
    except Exception as e:
        log_test("GET preview-correos (no token)", "FAIL", f"Error: {str(e)}")
    
    # Test enviar-correos without token
    try:
        response = requests.post(
            f"{API_URL}/usuarios/{fake_id}/enviar-correos",
            json={},
            timeout=30
        )
        
        if response.status_code == 401:
            log_test("POST enviar-correos (no token)", "PASS", "Got 401 as expected")
        else:
            log_test("POST enviar-correos (no token)", "FAIL", f"Expected 401, got {response.status_code}")
    except Exception as e:
        log_test("POST enviar-correos (no token)", "FAIL", f"Error: {str(e)}")

def main():
    """Main test runner"""
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}Aptiva RL - Email Notifications Backend Testing{RESET}")
    print(f"{BLUE}Testing NEW feature: Notificación de vencimientos por correo{RESET}")
    print(f"{BLUE}Base URL: {BASE_URL}{RESET}")
    print(f"{BLUE}Test recipient: {TEST_EMAIL} (safe throwaway){RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    
    # Test 1: Login
    token = test_1_admin_login()
    if not token:
        print(f"\n{RED}CRITICAL: Cannot proceed without admin token{RESET}")
        sys.exit(1)
    
    # Test 2: GET /api/usuarios
    usuarios, mandantesAll = test_2_get_usuarios(token)
    if not usuarios or not mandantesAll:
        print(f"\n{RED}CRITICAL: Cannot proceed without usuarios/mandantesAll{RESET}")
        sys.exit(1)
    
    # Test 3: Preview correos
    test_3_preview_correos(token, usuarios)
    
    # Test 4: CRON auth
    test_4_cron_auth(token)
    
    # Test 5: Manual send
    test_5_manual_send(token, mandantesAll)
    
    # Test 6: Toggle notificar_email
    test_6_toggle_notificar_email(token, mandantesAll)
    
    # Test 7: Authorization
    test_7_authorization()
    
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{GREEN}Testing complete!{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")

if __name__ == "__main__":
    main()
