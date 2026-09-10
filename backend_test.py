#!/usr/bin/env python3
"""
Backend API Testing for Aptiva RL Platform - Dashboard Enhanced Endpoint
Tests the enhanced GET /api/dashboard endpoint with new tendencia_vencimientos and proximos_vencimientos arrays
"""

import requests
import json
from datetime import datetime

# Base URL from .env
BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@aptivarl.com"
ADMIN_PASSWORD = "Aptiva2025!"

# Global token storage
token = None

def print_test(name, passed, details=""):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"  Details: {details}")
    print()

def login():
    """Login and get token"""
    global token
    print("=" * 80)
    print("AUTHENTICATION")
    print("=" * 80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            profile = data.get("profile", {})
            print_test(
                "Login as admin",
                True,
                f"Role: {profile.get('role_codigo')}, Email: {profile.get('email')}"
            )
            return True
        else:
            print_test("Login as admin", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        print_test("Login as admin", False, f"Exception: {str(e)}")
        return False

def get_headers():
    """Get authorization headers"""
    return {"Authorization": f"Bearer {token}"}

def test_dashboard_no_filters():
    """Test GET /api/dashboard with no filters"""
    print("=" * 80)
    print("TEST 1: Dashboard with no filters")
    print("=" * 80)
    
    try:
        response = requests.get(f"{BASE_URL}/dashboard", headers=get_headers(), timeout=30)
        
        if response.status_code != 200:
            print_test("Dashboard no filters - Status 200", False, f"Got {response.status_code}: {response.text}")
            return None
        
        print_test("Dashboard no filters - Status 200", True)
        
        data = response.json()
        
        # Check existing fields
        required_keys = ["stats", "acreditacion_por_mandante", "docs_por_estado", "tendencia_vencimientos", "proximos_vencimientos"]
        missing_keys = [k for k in required_keys if k not in data]
        
        if missing_keys:
            print_test("Dashboard response has all required keys", False, f"Missing: {missing_keys}")
            return None
        
        print_test("Dashboard response has all required keys", True, f"Keys: {list(data.keys())}")
        
        # Check stats object
        stats = data.get("stats", {})
        required_stats = [
            "mandantes", "contratos_vigentes", "trabajadores", "vehiculos", "equipos",
            "docs_pendientes", "docs_por_vencer", "docs_vencidos",
            "trabajadores_acreditados", "trabajadores_bloqueados", "trabajadores_revision"
        ]
        missing_stats = [k for k in required_stats if k not in stats]
        
        if missing_stats:
            print_test("Stats object has all required fields", False, f"Missing: {missing_stats}")
        else:
            print_test("Stats object has all required fields", True, f"Stats: {json.dumps(stats, indent=2)}")
        
        # Check acreditacion_por_mandante
        acred = data.get("acreditacion_por_mandante", {})
        if isinstance(acred, dict):
            print_test("acreditacion_por_mandante is object/map", True, f"Mandantes: {len(acred)}")
        else:
            print_test("acreditacion_por_mandante is object/map", False, f"Got type: {type(acred)}")
        
        # Check docs_por_estado
        docs_estado = data.get("docs_por_estado", [])
        if isinstance(docs_estado, list):
            if len(docs_estado) > 0:
                sample = docs_estado[0]
                has_estado = "estado" in sample
                has_c = "c" in sample
                print_test(
                    "docs_por_estado is array of {estado, c}",
                    has_estado and has_c,
                    f"Length: {len(docs_estado)}, Sample: {sample}"
                )
            else:
                print_test("docs_por_estado is array of {estado, c}", True, "Empty array (no documents)")
        else:
            print_test("docs_por_estado is array", False, f"Got type: {type(docs_estado)}")
        
        # NEW: Check tendencia_vencimientos
        tendencia = data.get("tendencia_vencimientos", [])
        if not isinstance(tendencia, list):
            print_test("tendencia_vencimientos is array", False, f"Got type: {type(tendencia)}")
        elif len(tendencia) != 6:
            print_test("tendencia_vencimientos has exactly 6 months", False, f"Got {len(tendencia)} months: {tendencia}")
        else:
            print_test("tendencia_vencimientos has exactly 6 months", True)
            
            # Check structure of each month
            all_valid = True
            has_zeros = False
            for i, month in enumerate(tendencia):
                if not isinstance(month, dict):
                    print_test(f"tendencia_vencimientos[{i}] is object", False, f"Got type: {type(month)}")
                    all_valid = False
                    continue
                
                if "mes" not in month or "c" not in month:
                    print_test(f"tendencia_vencimientos[{i}] has mes and c", False, f"Got keys: {list(month.keys())}")
                    all_valid = False
                    continue
                
                # Check mes format YYYY-MM
                mes = month.get("mes")
                try:
                    datetime.strptime(mes, "%Y-%m")
                    mes_valid = True
                except:
                    mes_valid = False
                
                if not mes_valid:
                    print_test(f"tendencia_vencimientos[{i}] mes format YYYY-MM", False, f"Got: {mes}")
                    all_valid = False
                
                # Check c is integer
                c = month.get("c")
                if not isinstance(c, int):
                    print_test(f"tendencia_vencimientos[{i}] c is integer", False, f"Got type: {type(c)}, value: {c}")
                    all_valid = False
                
                if c == 0:
                    has_zeros = True
            
            if all_valid:
                print_test("tendencia_vencimientos structure valid", True, f"All 6 months have correct structure")
                print(f"  Tendencia: {json.dumps(tendencia, indent=2)}")
            
            # Check if months are in ascending order
            meses = [m.get("mes") for m in tendencia]
            sorted_meses = sorted(meses)
            if meses == sorted_meses:
                print_test("tendencia_vencimientos months in ascending order", True, f"Months: {meses}")
            else:
                print_test("tendencia_vencimientos months in ascending order", False, f"Got: {meses}, Expected: {sorted_meses}")
            
            # Note about zeros
            if has_zeros:
                print_test("tendencia_vencimientos includes months with c=0", True, "Months with zero expirations are present")
            else:
                print("  ℹ️  Note: No months with c=0 found (all months have expirations)")
        
        # NEW: Check proximos_vencimientos
        proximos = data.get("proximos_vencimientos", [])
        if not isinstance(proximos, list):
            print_test("proximos_vencimientos is array", False, f"Got type: {type(proximos)}")
        else:
            print_test("proximos_vencimientos is array", True, f"Length: {len(proximos)}")
            
            if len(proximos) > 15:
                print_test("proximos_vencimientos length <= 15", False, f"Got {len(proximos)} items")
            else:
                print_test("proximos_vencimientos length <= 15", True)
            
            if len(proximos) > 0:
                # Check structure of each item
                required_fields = [
                    "documento_id", "recurso_tipo", "recurso_id", "fecha_vencimiento",
                    "documento", "mandante", "dias_restantes", "recurso"
                ]
                
                all_valid = True
                all_within_90_days = True
                all_aprobado = True
                all_recurso_non_empty = True
                all_dias_int = True
                
                for i, item in enumerate(proximos):
                    if not isinstance(item, dict):
                        print_test(f"proximos_vencimientos[{i}] is object", False, f"Got type: {type(item)}")
                        all_valid = False
                        continue
                    
                    missing = [f for f in required_fields if f not in item]
                    if missing:
                        print_test(f"proximos_vencimientos[{i}] has all fields", False, f"Missing: {missing}")
                        all_valid = False
                        continue
                    
                    # Check recurso is non-empty string
                    recurso = item.get("recurso")
                    if not isinstance(recurso, str) or recurso.strip() == "" or recurso == "—":
                        print_test(f"proximos_vencimientos[{i}] recurso is non-empty string", False, f"Got: '{recurso}'")
                        all_recurso_non_empty = False
                    
                    # Check dias_restantes is integer
                    dias = item.get("dias_restantes")
                    if not isinstance(dias, int):
                        print_test(f"proximos_vencimientos[{i}] dias_restantes is integer", False, f"Got type: {type(dias)}, value: {dias}")
                        all_dias_int = False
                    
                    # Check dias_restantes <= 90
                    if isinstance(dias, int) and dias > 90:
                        print_test(f"proximos_vencimientos[{i}] dias_restantes <= 90", False, f"Got: {dias}")
                        all_within_90_days = False
                
                if all_valid:
                    print_test("proximos_vencimientos structure valid", True, f"All {len(proximos)} items have correct structure")
                    print(f"  Sample (first 3): {json.dumps(proximos[:3], indent=2, default=str)}")
                
                if all_recurso_non_empty:
                    print_test("proximos_vencimientos all recurso non-empty", True)
                
                if all_dias_int:
                    print_test("proximos_vencimientos all dias_restantes are integers", True)
                
                if all_within_90_days:
                    print_test("proximos_vencimientos all dias_restantes <= 90", True)
                
                # Check if sorted by fecha_vencimiento ascending
                fechas = [item.get("fecha_vencimiento") for item in proximos]
                sorted_fechas = sorted(fechas)
                if fechas == sorted_fechas:
                    print_test("proximos_vencimientos sorted by fecha_vencimiento asc", True)
                else:
                    print_test("proximos_vencimientos sorted by fecha_vencimiento asc", False, f"Not sorted correctly")
            else:
                print("  ℹ️  Note: No proximos_vencimientos found (no documents expiring within 90 days)")
        
        return data
        
    except Exception as e:
        print_test("Dashboard no filters", False, f"Exception: {str(e)}")
        return None

def test_dashboard_with_mandante_filter():
    """Test GET /api/dashboard?mandante_id=X"""
    print("=" * 80)
    print("TEST 2: Dashboard with mandante_id filter")
    print("=" * 80)
    
    try:
        # First get a real mandante_id
        response = requests.get(f"{BASE_URL}/mandantes", headers=get_headers(), timeout=30)
        if response.status_code != 200:
            print_test("Get mandantes list", False, f"Status: {response.status_code}")
            return
        
        mandantes = response.json().get("mandantes", [])
        if not mandantes:
            print_test("Get mandantes list", False, "No mandantes found")
            return
        
        # Find a mandante that has documents
        mandante_id = None
        mandante_name = None
        
        for m in mandantes:
            # Check if this mandante has documents
            check_response = requests.get(
                f"{BASE_URL}/dashboard?mandante_id={m['mandante_id']}",
                headers=get_headers(),
                timeout=30
            )
            if check_response.status_code == 200:
                check_data = check_response.json()
                docs_estado = check_data.get("docs_por_estado", [])
                total_docs = sum(d.get("c", 0) for d in docs_estado)
                if total_docs > 0:
                    mandante_id = m['mandante_id']
                    mandante_name = m['razon_social']
                    break
        
        if not mandante_id:
            # Just use the first mandante
            mandante_id = mandantes[0]['mandante_id']
            mandante_name = mandantes[0]['razon_social']
        
        print_test("Get mandante_id for testing", True, f"Using: {mandante_name} ({mandante_id})")
        
        # Test dashboard with mandante filter
        response = requests.get(
            f"{BASE_URL}/dashboard?mandante_id={mandante_id}",
            headers=get_headers(),
            timeout=30
        )
        
        if response.status_code != 200:
            print_test("Dashboard with mandante_id - Status 200", False, f"Got {response.status_code}: {response.text}")
            return
        
        print_test("Dashboard with mandante_id - Status 200", True)
        
        data = response.json()
        
        # Check response is well-formed
        required_keys = ["stats", "acreditacion_por_mandante", "docs_por_estado", "tendencia_vencimientos", "proximos_vencimientos"]
        missing_keys = [k for k in required_keys if k not in data]
        
        if missing_keys:
            print_test("Dashboard response well-formed", False, f"Missing keys: {missing_keys}")
        else:
            print_test("Dashboard response well-formed", True, "All keys present")
        
        # Check tendencia_vencimientos still 6 months
        tendencia = data.get("tendencia_vencimientos", [])
        if len(tendencia) == 6:
            print_test("tendencia_vencimientos still 6 months with filter", True)
        else:
            print_test("tendencia_vencimientos still 6 months with filter", False, f"Got {len(tendencia)} months")
        
        # Check proximos_vencimientos filtered by mandante
        proximos = data.get("proximos_vencimientos", [])
        if len(proximos) > 0:
            all_match_mandante = all(item.get("mandante") == mandante_name for item in proximos)
            if all_match_mandante:
                print_test("proximos_vencimientos filtered by mandante", True, f"All {len(proximos)} items match mandante")
            else:
                mismatches = [item.get("mandante") for item in proximos if item.get("mandante") != mandante_name]
                print_test("proximos_vencimientos filtered by mandante", False, f"Found mismatches: {mismatches}")
        else:
            print("  ℹ️  Note: No proximos_vencimientos for this mandante")
        
        print(f"  Stats: {json.dumps(data.get('stats'), indent=2)}")
        
    except Exception as e:
        print_test("Dashboard with mandante_id filter", False, f"Exception: {str(e)}")

def test_dashboard_with_empresa_filter():
    """Test GET /api/dashboard?empresa_id=X"""
    print("=" * 80)
    print("TEST 3: Dashboard with empresa_id filter")
    print("=" * 80)
    
    try:
        # First get a real empresa_id
        response = requests.get(f"{BASE_URL}/empresas", headers=get_headers(), timeout=30)
        if response.status_code != 200:
            print_test("Get empresas list", False, f"Status: {response.status_code}")
            return
        
        empresas = response.json().get("empresas", [])
        if not empresas:
            print_test("Get empresas list", False, "No empresas found")
            return
        
        empresa_id = empresas[0]['empresa_id']
        empresa_name = empresas[0]['razon_social']
        
        print_test("Get empresa_id for testing", True, f"Using: {empresa_name} ({empresa_id})")
        
        # Test dashboard with empresa filter
        response = requests.get(
            f"{BASE_URL}/dashboard?empresa_id={empresa_id}",
            headers=get_headers(),
            timeout=30
        )
        
        if response.status_code != 200:
            print_test("Dashboard with empresa_id - Status 200", False, f"Got {response.status_code}: {response.text}")
            return
        
        print_test("Dashboard with empresa_id - Status 200", True)
        
        data = response.json()
        
        # Check response is well-formed
        required_keys = ["stats", "acreditacion_por_mandante", "docs_por_estado", "tendencia_vencimientos", "proximos_vencimientos"]
        missing_keys = [k for k in required_keys if k not in data]
        
        if missing_keys:
            print_test("Dashboard response well-formed", False, f"Missing keys: {missing_keys}")
        else:
            print_test("Dashboard response well-formed", True, "All keys present")
        
        print(f"  Stats: {json.dumps(data.get('stats'), indent=2)}")
        
    except Exception as e:
        print_test("Dashboard with empresa_id filter", False, f"Exception: {str(e)}")

def test_dashboard_with_combined_filters():
    """Test GET /api/dashboard?empresa_id=X&mandante_id=Y"""
    print("=" * 80)
    print("TEST 4: Dashboard with combined filters")
    print("=" * 80)
    
    try:
        # Get empresa_id
        response = requests.get(f"{BASE_URL}/empresas", headers=get_headers(), timeout=30)
        if response.status_code != 200:
            print_test("Get empresas list", False, f"Status: {response.status_code}")
            return
        
        empresas = response.json().get("empresas", [])
        if not empresas:
            print_test("Get empresas list", False, "No empresas found")
            return
        
        empresa_id = empresas[0]['empresa_id']
        
        # Get mandante_id
        response = requests.get(f"{BASE_URL}/mandantes", headers=get_headers(), timeout=30)
        if response.status_code != 200:
            print_test("Get mandantes list", False, f"Status: {response.status_code}")
            return
        
        mandantes = response.json().get("mandantes", [])
        if not mandantes:
            print_test("Get mandantes list", False, "No mandantes found")
            return
        
        mandante_id = mandantes[0]['mandante_id']
        
        print_test("Get empresa_id and mandante_id for testing", True, f"empresa_id: {empresa_id}, mandante_id: {mandante_id}")
        
        # Test dashboard with combined filters
        response = requests.get(
            f"{BASE_URL}/dashboard?empresa_id={empresa_id}&mandante_id={mandante_id}",
            headers=get_headers(),
            timeout=30
        )
        
        if response.status_code != 200:
            print_test("Dashboard with combined filters - Status 200", False, f"Got {response.status_code}: {response.text}")
            return
        
        print_test("Dashboard with combined filters - Status 200", True)
        
        data = response.json()
        
        # Check response is well-formed
        required_keys = ["stats", "acreditacion_por_mandante", "docs_por_estado", "tendencia_vencimientos", "proximos_vencimientos"]
        missing_keys = [k for k in required_keys if k not in data]
        
        if missing_keys:
            print_test("Dashboard response well-formed and coherent", False, f"Missing keys: {missing_keys}")
        else:
            print_test("Dashboard response well-formed and coherent", True, "All keys present")
        
        print(f"  Stats: {json.dumps(data.get('stats'), indent=2)}")
        
    except Exception as e:
        print_test("Dashboard with combined filters", False, f"Exception: {str(e)}")

def test_regression():
    """Test that existing fields are still intact"""
    print("=" * 80)
    print("TEST 5: Regression - Existing fields intact")
    print("=" * 80)
    
    try:
        response = requests.get(f"{BASE_URL}/dashboard", headers=get_headers(), timeout=30)
        
        if response.status_code != 200:
            print_test("Dashboard regression - Status 200", False, f"Got {response.status_code}")
            return
        
        data = response.json()
        
        # Check stats
        stats = data.get("stats", {})
        required_stats = [
            "mandantes", "contratos_vigentes", "trabajadores", "vehiculos", "equipos",
            "docs_pendientes", "docs_por_vencer", "docs_vencidos",
            "trabajadores_acreditados", "trabajadores_bloqueados", "trabajadores_revision"
        ]
        
        all_present = all(k in stats for k in required_stats)
        if all_present:
            print_test("Regression: stats fields intact", True, f"All {len(required_stats)} fields present")
        else:
            missing = [k for k in required_stats if k not in stats]
            print_test("Regression: stats fields intact", False, f"Missing: {missing}")
        
        # Check acreditacion_por_mandante
        acred = data.get("acreditacion_por_mandante")
        if isinstance(acred, dict):
            print_test("Regression: acreditacion_por_mandante intact", True, f"Type: dict, Keys: {len(acred)}")
        else:
            print_test("Regression: acreditacion_por_mandante intact", False, f"Type: {type(acred)}")
        
        # Check docs_por_estado
        docs_estado = data.get("docs_por_estado")
        if isinstance(docs_estado, list):
            print_test("Regression: docs_por_estado intact", True, f"Type: list, Length: {len(docs_estado)}")
        else:
            print_test("Regression: docs_por_estado intact", False, f"Type: {type(docs_estado)}")
        
    except Exception as e:
        print_test("Regression tests", False, f"Exception: {str(e)}")

def main():
    """Main test runner"""
    print("\n")
    print("=" * 80)
    print("APTIVA RL BACKEND TESTING - ENHANCED DASHBOARD ENDPOINT")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Testing as: {ADMIN_EMAIL}")
    print("=" * 80)
    print("\n")
    
    # Login
    if not login():
        print("\n❌ LOGIN FAILED - Cannot proceed with tests")
        return
    
    # Run tests
    test_dashboard_no_filters()
    test_dashboard_with_mandante_filter()
    test_dashboard_with_empresa_filter()
    test_dashboard_with_combined_filters()
    test_regression()
    
    print("\n")
    print("=" * 80)
    print("TESTING COMPLETE")
    print("=" * 80)
    print("\n")

if __name__ == "__main__":
    main()
