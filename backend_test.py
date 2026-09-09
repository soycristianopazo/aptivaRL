#!/usr/bin/env python3
"""
Comprehensive backend API tests for Aptiva RL
Tests all endpoints with proper authentication and authorization
"""
import requests
import json
import sys
import time
from typing import Dict, Optional

# Configuration
BASE_URL = "https://aptiva-db.preview.emergentagent.com/api"
SUPERADMIN_EMAIL = "admin@aptivarl.com"
SUPERADMIN_PASSWORD = "Aptiva2025!"

# Test state
superadmin_token = None
worker_token = None
worker_user_id = None
test_course_id = None
test_enrollment_id = None
test_company_id = None
demo_course_ids = []

def log_test(name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   Details: {details}")
    return passed

def make_request(method: str, endpoint: str, token: Optional[str] = None, data: Optional[Dict] = None, params: Optional[Dict] = None):
    """Make HTTP request with proper headers"""
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    # Add small delay to avoid overwhelming the server
    time.sleep(0.2)
    
    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, params=params, timeout=20)
        elif method == "POST":
            resp = requests.post(url, headers=headers, json=data, timeout=20)
        elif method == "PUT":
            resp = requests.put(url, headers=headers, json=data, timeout=20)
        elif method == "DELETE":
            resp = requests.delete(url, headers=headers, timeout=20)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return resp
    except requests.exceptions.Timeout as e:
        print(f"   ⚠️  Request timeout after 20s: {str(e)}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"   ⚠️  Request error: {str(e)}")
        return None
    except Exception as e:
        print(f"   ⚠️  Unexpected error: {str(e)}")
        return None

def test_health():
    """Test 1: GET /api/health"""
    print("\n=== Test 1: Health Check ===")
    resp = make_request("GET", "/health")
    
    if not resp:
        return log_test("Health endpoint", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Health endpoint", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if data.get("ok") == True and data.get("service") == "aptiva-rl":
        return log_test("Health endpoint", True, f"Response: {data}")
    else:
        return log_test("Health endpoint", False, f"Unexpected response: {data}")

def test_auth_register():
    """Test 2a: POST /api/auth/register - create worker"""
    global worker_token, worker_user_id
    print("\n=== Test 2a: Register New Worker ===")
    
    # Use unique email with timestamp
    import time
    email = f"worker_{int(time.time())}@test.com"
    
    resp = make_request("POST", "/auth/register", data={
        "email": email,
        "password": "Worker123!",
        "full_name": "Test Worker",
        "rut": "12345678-9"
    })
    
    if not resp:
        return log_test("Register worker", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("Register worker", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "token" in data and "user" in data:
        worker_token = data["token"]
        worker_user_id = data["user"]["user_id"]
        if data["user"]["role"] == "worker":
            return log_test("Register worker", True, f"Created worker with email {email}")
        else:
            return log_test("Register worker", False, f"Expected role 'worker', got {data['user']['role']}")
    else:
        return log_test("Register worker", False, f"Missing token or user in response: {data}")

def test_auth_register_duplicate():
    """Test 2b: POST /api/auth/register - duplicate email"""
    print("\n=== Test 2b: Register Duplicate Email ===")
    
    resp = make_request("POST", "/auth/register", data={
        "email": SUPERADMIN_EMAIL,
        "password": "test123",
        "full_name": "Duplicate User"
    })
    
    if not resp:
        return log_test("Register duplicate email", False, "Request failed")
    
    if resp.status_code == 409:
        return log_test("Register duplicate email", True, "Correctly rejected with 409")
    else:
        return log_test("Register duplicate email", False, f"Expected 409, got {resp.status_code}")

def test_auth_login_superadmin():
    """Test 2c: POST /api/auth/login - superadmin"""
    global superadmin_token
    print("\n=== Test 2c: Login Superadmin ===")
    
    resp = make_request("POST", "/auth/login", data={
        "email": SUPERADMIN_EMAIL,
        "password": SUPERADMIN_PASSWORD
    })
    
    if not resp:
        return log_test("Login superadmin", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Login superadmin", False, f"Expected 200, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "token" in data and "user" in data:
        superadmin_token = data["token"]
        if data["user"]["role"] == "superadmin":
            return log_test("Login superadmin", True, f"Logged in as {data['user']['email']}")
        else:
            return log_test("Login superadmin", False, f"Expected role 'superadmin', got {data['user']['role']}")
    else:
        return log_test("Login superadmin", False, f"Missing token or user: {data}")

def test_auth_login_wrong_password():
    """Test 2d: POST /api/auth/login - wrong password"""
    print("\n=== Test 2d: Login Wrong Password ===")
    
    resp = make_request("POST", "/auth/login", data={
        "email": SUPERADMIN_EMAIL,
        "password": "wrongpassword"
    })
    
    if not resp:
        return log_test("Login wrong password", False, "Request failed")
    
    if resp.status_code == 401:
        return log_test("Login wrong password", True, "Correctly rejected with 401")
    else:
        return log_test("Login wrong password", False, f"Expected 401, got {resp.status_code}")

def test_auth_me_with_token():
    """Test 2e: GET /api/auth/me - with token"""
    print("\n=== Test 2e: Get Current User (with token) ===")
    
    resp = make_request("GET", "/auth/me", token=superadmin_token)
    
    if not resp:
        return log_test("Get current user", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Get current user", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "user" in data and data["user"]["email"] == SUPERADMIN_EMAIL:
        return log_test("Get current user", True, f"Retrieved user: {data['user']['full_name']}")
    else:
        return log_test("Get current user", False, f"Unexpected response: {data}")

def test_auth_me_without_token():
    """Test 2f: GET /api/auth/me - without token"""
    print("\n=== Test 2f: Get Current User (without token) ===")
    
    resp = make_request("GET", "/auth/me")
    
    if not resp:
        return log_test("Get current user without token", False, "Request failed")
    
    if resp.status_code == 401:
        return log_test("Get current user without token", True, "Correctly rejected with 401")
    else:
        return log_test("Get current user without token", False, f"Expected 401, got {resp.status_code}")

def test_courses_list():
    """Test 3a: GET /api/courses - list with counts"""
    global demo_course_ids
    print("\n=== Test 3a: List Courses ===")
    
    resp = make_request("GET", "/courses", token=superadmin_token)
    
    if not resp:
        return log_test("List courses", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("List courses", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "courses" in data and isinstance(data["courses"], list):
        courses = data["courses"]
        if len(courses) >= 3:  # Should have at least 3 demo courses
            # Check for lessons_count and quiz_count
            first_course = courses[0]
            if "lessons_count" in first_course and "quiz_count" in first_course:
                demo_course_ids = [c["course_id"] for c in courses[:3]]
                return log_test("List courses", True, f"Found {len(courses)} courses with counts")
            else:
                return log_test("List courses", False, "Missing lessons_count or quiz_count")
        else:
            return log_test("List courses", False, f"Expected at least 3 courses, got {len(courses)}")
    else:
        return log_test("List courses", False, f"Unexpected response: {data}")

def test_courses_get_single():
    """Test 3b: GET /api/courses/:id - full course"""
    print("\n=== Test 3b: Get Single Course ===")
    
    if not demo_course_ids:
        return log_test("Get single course", False, "No course IDs available")
    
    course_id = demo_course_ids[0]
    resp = make_request("GET", f"/courses/{course_id}", token=superadmin_token)
    
    if not resp:
        return log_test("Get single course", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Get single course", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "course" in data:
        course = data["course"]
        if "lessons" in course and "quiz" in course:
            return log_test("Get single course", True, f"Retrieved course: {course['title']}")
        else:
            return log_test("Get single course", False, "Missing lessons or quiz arrays")
    else:
        return log_test("Get single course", False, f"Unexpected response: {data}")

def test_courses_create_as_superadmin():
    """Test 3c: POST /api/courses - as superadmin"""
    global test_course_id
    print("\n=== Test 3c: Create Course (superadmin) ===")
    
    resp = make_request("POST", "/courses", token=superadmin_token, data={
        "title": "Test Course - Safety Training",
        "description": "A test course for automated testing",
        "category": "Safety",
        "duration_minutes": 45,
        "pass_score": 75,
        "lessons": [
            {"title": "Lesson 1", "content": "Introduction to safety"},
            {"title": "Lesson 2", "content": "Safety procedures"}
        ],
        "quiz": [
            {"question": "What is safety?", "options": ["Important", "Not important", "Maybe"], "answer": 0},
            {"question": "Should you wear PPE?", "options": ["No", "Yes", "Sometimes"], "answer": 1}
        ]
    })
    
    if not resp:
        return log_test("Create course (superadmin)", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("Create course (superadmin)", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "course" in data and "course_id" in data["course"]:
        test_course_id = data["course"]["course_id"]
        return log_test("Create course (superadmin)", True, f"Created course: {data['course']['title']}")
    else:
        return log_test("Create course (superadmin)", False, f"Unexpected response: {data}")

def test_courses_create_as_worker():
    """Test 3d: POST /api/courses - as worker (should fail)"""
    print("\n=== Test 3d: Create Course (worker - should fail) ===")
    
    resp = make_request("POST", "/courses", token=worker_token, data={
        "title": "Unauthorized Course",
        "description": "This should not be created"
    })
    
    if not resp:
        return log_test("Create course (worker)", False, "Request failed")
    
    if resp.status_code == 403:
        return log_test("Create course (worker)", True, "Correctly rejected with 403")
    else:
        return log_test("Create course (worker)", False, f"Expected 403, got {resp.status_code}")

def test_courses_update():
    """Test 3e: PUT /api/courses/:id - update course"""
    print("\n=== Test 3e: Update Course ===")
    
    if not test_course_id:
        return log_test("Update course", False, "No test course ID available")
    
    resp = make_request("PUT", f"/courses/{test_course_id}", token=superadmin_token, data={
        "title": "Test Course - Safety Training (Updated)",
        "description": "Updated description"
    })
    
    if not resp:
        return log_test("Update course", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Update course", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "course" in data and "Updated" in data["course"]["title"]:
        return log_test("Update course", True, f"Updated course title")
    else:
        return log_test("Update course", False, f"Unexpected response: {data}")

def test_enrollments_create():
    """Test 4a: POST /api/enrollments - create enrollment"""
    global test_enrollment_id
    print("\n=== Test 4a: Create Enrollment (worker) ===")
    
    if not demo_course_ids:
        return log_test("Create enrollment", False, "No course IDs available")
    
    course_id = demo_course_ids[0]
    resp = make_request("POST", "/enrollments", token=worker_token, data={
        "course_id": course_id
    })
    
    if not resp:
        return log_test("Create enrollment", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("Create enrollment", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "enrollment" in data and data["enrollment"]["status"] == "enrolled":
        test_enrollment_id = data["enrollment"]["enrollment_id"]
        return log_test("Create enrollment", True, f"Created enrollment with status 'enrolled'")
    else:
        return log_test("Create enrollment", False, f"Unexpected response: {data}")

def test_enrollments_create_duplicate():
    """Test 4b: POST /api/enrollments - duplicate (should return existing)"""
    print("\n=== Test 4b: Create Duplicate Enrollment ===")
    
    if not demo_course_ids:
        return log_test("Create duplicate enrollment", False, "No course IDs available")
    
    course_id = demo_course_ids[0]
    resp = make_request("POST", "/enrollments", token=worker_token, data={
        "course_id": course_id
    })
    
    if not resp:
        return log_test("Create duplicate enrollment", False, "Request failed")
    
    if resp.status_code == 200:  # Should return existing, not create new
        data = resp.json()
        if "enrollment" in data:
            return log_test("Create duplicate enrollment", True, "Returned existing enrollment")
        else:
            return log_test("Create duplicate enrollment", False, f"Unexpected response: {data}")
    else:
        return log_test("Create duplicate enrollment", False, f"Expected 200, got {resp.status_code}")

def test_enrollments_complete_passing():
    """Test 4c: POST /api/enrollments/:id/complete - passing score"""
    print("\n=== Test 4c: Complete Enrollment (passing score) ===")
    
    if not test_enrollment_id:
        return log_test("Complete enrollment (passing)", False, "No enrollment ID available")
    
    resp = make_request("POST", f"/enrollments/{test_enrollment_id}/complete", token=worker_token, data={
        "score": 100
    })
    
    if not resp:
        return log_test("Complete enrollment (passing)", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Complete enrollment (passing)", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "enrollment" in data and "passed" in data:
        enrollment = data["enrollment"]
        if data["passed"] == True and enrollment["status"] == "completed" and enrollment["completed_at"] is not None:
            return log_test("Complete enrollment (passing)", True, f"Passed with score {enrollment['score']}, status 'completed'")
        else:
            return log_test("Complete enrollment (passing)", False, f"Expected passed=True, status='completed', completed_at set. Got: {data}")
    else:
        return log_test("Complete enrollment (passing)", False, f"Unexpected response: {data}")

def test_enrollments_complete_failing():
    """Test 4d: POST /api/enrollments/:id/complete - failing score"""
    print("\n=== Test 4d: Complete Enrollment (failing score) ===")
    
    # Create another enrollment for failing test
    if not demo_course_ids or len(demo_course_ids) < 2:
        return log_test("Complete enrollment (failing)", False, "Not enough course IDs available")
    
    course_id = demo_course_ids[1]
    resp = make_request("POST", "/enrollments", token=worker_token, data={
        "course_id": course_id
    })
    
    if not resp or resp.status_code not in [200, 201]:
        return log_test("Complete enrollment (failing)", False, "Failed to create enrollment for test")
    
    enrollment_id = resp.json()["enrollment"]["enrollment_id"]
    
    # Complete with failing score
    resp = make_request("POST", f"/enrollments/{enrollment_id}/complete", token=worker_token, data={
        "score": 40
    })
    
    if not resp:
        return log_test("Complete enrollment (failing)", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Complete enrollment (failing)", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "enrollment" in data and "passed" in data:
        enrollment = data["enrollment"]
        if data["passed"] == False and enrollment["status"] == "in_progress" and enrollment["completed_at"] is None:
            return log_test("Complete enrollment (failing)", True, f"Failed with score {enrollment['score']}, status 'in_progress', completed_at null")
        else:
            return log_test("Complete enrollment (failing)", False, f"Expected passed=False, status='in_progress', completed_at=null. Got: {data}")
    else:
        return log_test("Complete enrollment (failing)", False, f"Unexpected response: {data}")

def test_enrollments_list_worker():
    """Test 4e: GET /api/enrollments - worker sees only their enrollments"""
    print("\n=== Test 4e: List Enrollments (worker) ===")
    
    resp = make_request("GET", "/enrollments", token=worker_token)
    
    if not resp:
        return log_test("List enrollments (worker)", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("List enrollments (worker)", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "enrollments" in data and isinstance(data["enrollments"], list):
        enrollments = data["enrollments"]
        if len(enrollments) > 0:
            # Check for joined fields
            first = enrollments[0]
            if "course_title" in first and "category" in first and "user_name" in first:
                return log_test("List enrollments (worker)", True, f"Found {len(enrollments)} enrollments with joined data")
            else:
                return log_test("List enrollments (worker)", False, "Missing joined fields (course_title, category, user_name)")
        else:
            return log_test("List enrollments (worker)", False, "No enrollments found")
    else:
        return log_test("List enrollments (worker)", False, f"Unexpected response: {data}")

def test_enrollments_list_admin():
    """Test 4f: GET /api/enrollments?all=1 - superadmin sees all"""
    print("\n=== Test 4f: List All Enrollments (superadmin) ===")
    
    resp = make_request("GET", "/enrollments", token=superadmin_token, params={"all": "1"})
    
    if not resp:
        return log_test("List all enrollments (superadmin)", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("List all enrollments (superadmin)", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "enrollments" in data and isinstance(data["enrollments"], list):
        enrollments = data["enrollments"]
        return log_test("List all enrollments (superadmin)", True, f"Found {len(enrollments)} total enrollments")
    else:
        return log_test("List all enrollments (superadmin)", False, f"Unexpected response: {data}")

def test_companies_create():
    """Test 5a: POST /api/companies - create company"""
    global test_company_id
    print("\n=== Test 5a: Create Company (superadmin) ===")
    
    resp = make_request("POST", "/companies", token=superadmin_token, data={
        "name": "Test Mining Company",
        "rut": "99.999.999-9"
    })
    
    if not resp:
        return log_test("Create company", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("Create company", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "company" in data and "company_id" in data["company"]:
        test_company_id = data["company"]["company_id"]
        return log_test("Create company", True, f"Created company: {data['company']['name']}")
    else:
        return log_test("Create company", False, f"Unexpected response: {data}")

def test_companies_list():
    """Test 5b: GET /api/companies - list with users_count"""
    print("\n=== Test 5b: List Companies ===")
    
    resp = make_request("GET", "/companies", token=superadmin_token)
    
    if not resp:
        return log_test("List companies", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("List companies", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "companies" in data and isinstance(data["companies"], list):
        companies = data["companies"]
        if len(companies) > 0:
            first = companies[0]
            if "users_count" in first:
                return log_test("List companies", True, f"Found {len(companies)} companies with users_count")
            else:
                return log_test("List companies", False, "Missing users_count field")
        else:
            return log_test("List companies", False, "No companies found")
    else:
        return log_test("List companies", False, f"Unexpected response: {data}")

def test_companies_create_as_worker():
    """Test 5c: POST /api/companies - as worker (should fail)"""
    print("\n=== Test 5c: Create Company (worker - should fail) ===")
    
    resp = make_request("POST", "/companies", token=worker_token, data={
        "name": "Unauthorized Company",
        "rut": "11.111.111-1"
    })
    
    if not resp:
        return log_test("Create company (worker)", False, "Request failed")
    
    if resp.status_code == 403:
        return log_test("Create company (worker)", True, "Correctly rejected with 403")
    else:
        return log_test("Create company (worker)", False, f"Expected 403, got {resp.status_code}")

def test_users_create():
    """Test 5d: POST /api/users - create user"""
    print("\n=== Test 5d: Create User (superadmin) ===")
    
    import time
    email = f"testuser_{int(time.time())}@test.com"
    
    resp = make_request("POST", "/users", token=superadmin_token, data={
        "email": email,
        "password": "TestUser123!",
        "full_name": "Test User Admin Created",
        "role": "admin",
        "company_id": test_company_id
    })
    
    if not resp:
        return log_test("Create user", False, "Request failed")
    
    if resp.status_code != 201:
        return log_test("Create user", False, f"Expected 201, got {resp.status_code}: {resp.text}")
    
    data = resp.json()
    if "user" in data and data["user"]["email"] == email:
        return log_test("Create user", True, f"Created user: {data['user']['full_name']}")
    else:
        return log_test("Create user", False, f"Unexpected response: {data}")

def test_users_list():
    """Test 5e: GET /api/users - list users"""
    print("\n=== Test 5e: List Users (superadmin) ===")
    
    resp = make_request("GET", "/users", token=superadmin_token)
    
    if not resp:
        return log_test("List users", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("List users", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if "users" in data and isinstance(data["users"], list):
        users = data["users"]
        return log_test("List users", True, f"Found {len(users)} users")
    else:
        return log_test("List users", False, f"Unexpected response: {data}")

def test_users_list_as_worker():
    """Test 5f: GET /api/users - as worker (should fail)"""
    print("\n=== Test 5f: List Users (worker - should fail) ===")
    
    resp = make_request("GET", "/users", token=worker_token)
    
    if not resp:
        return log_test("List users (worker)", False, "Request failed")
    
    if resp.status_code == 403:
        return log_test("List users (worker)", True, "Correctly rejected with 403")
    else:
        return log_test("List users (worker)", False, f"Expected 403, got {resp.status_code}")

def test_stats_superadmin():
    """Test 6a: GET /api/stats - superadmin"""
    print("\n=== Test 6a: Get Stats (superadmin) ===")
    
    resp = make_request("GET", "/stats", token=superadmin_token)
    
    if not resp:
        return log_test("Get stats (superadmin)", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Get stats (superadmin)", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    required_fields = ["total_courses", "total_users", "total_companies", "total_completions"]
    missing = [f for f in required_fields if f not in data]
    
    if not missing:
        return log_test("Get stats (superadmin)", True, f"Stats: {data}")
    else:
        return log_test("Get stats (superadmin)", False, f"Missing fields: {missing}")

def test_stats_worker():
    """Test 6b: GET /api/stats - worker"""
    print("\n=== Test 6b: Get Stats (worker) ===")
    
    resp = make_request("GET", "/stats", token=worker_token)
    
    if not resp:
        return log_test("Get stats (worker)", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Get stats (worker)", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    required_fields = ["my_enrolled", "my_completed"]
    missing = [f for f in required_fields if f not in data]
    
    if not missing:
        # Worker should NOT see admin fields
        if "total_users" not in data and "total_companies" not in data:
            return log_test("Get stats (worker)", True, f"Worker stats: enrolled={data['my_enrolled']}, completed={data['my_completed']}")
        else:
            return log_test("Get stats (worker)", False, "Worker should not see admin fields")
    else:
        return log_test("Get stats (worker)", False, f"Missing fields: {missing}")

def test_courses_delete():
    """Test 7: DELETE /api/courses/:id - delete course"""
    print("\n=== Test 7: Delete Course ===")
    
    if not test_course_id:
        return log_test("Delete course", False, "No test course ID available")
    
    resp = make_request("DELETE", f"/courses/{test_course_id}", token=superadmin_token)
    
    if not resp:
        return log_test("Delete course", False, "Request failed")
    
    if resp.status_code != 200:
        return log_test("Delete course", False, f"Expected 200, got {resp.status_code}")
    
    data = resp.json()
    if data.get("ok") == True:
        return log_test("Delete course", True, "Course deleted successfully")
    else:
        return log_test("Delete course", False, f"Unexpected response: {data}")

def main():
    """Run all tests"""
    print("=" * 60)
    print("APTIVA RL BACKEND API TESTS")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"Superadmin: {SUPERADMIN_EMAIL}")
    print("=" * 60)
    
    results = []
    
    # Test 1: Health
    results.append(test_health())
    
    # Test 2: Auth
    results.append(test_auth_register())
    results.append(test_auth_register_duplicate())
    results.append(test_auth_login_superadmin())
    results.append(test_auth_login_wrong_password())
    results.append(test_auth_me_with_token())
    results.append(test_auth_me_without_token())
    
    # Test 3: Courses
    results.append(test_courses_list())
    results.append(test_courses_get_single())
    results.append(test_courses_create_as_superadmin())
    results.append(test_courses_create_as_worker())
    results.append(test_courses_update())
    
    # Test 4: Enrollments
    results.append(test_enrollments_create())
    results.append(test_enrollments_create_duplicate())
    results.append(test_enrollments_complete_passing())
    results.append(test_enrollments_complete_failing())
    results.append(test_enrollments_list_worker())
    results.append(test_enrollments_list_admin())
    
    # Test 5: Users & Companies
    results.append(test_companies_create())
    results.append(test_companies_list())
    results.append(test_companies_create_as_worker())
    results.append(test_users_create())
    results.append(test_users_list())
    results.append(test_users_list_as_worker())
    
    # Test 6: Stats
    results.append(test_stats_superadmin())
    results.append(test_stats_worker())
    
    # Test 7: Delete
    results.append(test_courses_delete())
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"Passed: {passed}/{total}")
    print(f"Failed: {total - passed}/{total}")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
