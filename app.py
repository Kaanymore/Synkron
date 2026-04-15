"""
Synkron — E-Commerce Customer Intelligence Platform

Open-source customer data management, analysis, and automation
for e-commerce stores. Detect duplicates, fix phone numbers,
and clean your customer database.

Version: 1.0.0
License: MIT
Repository: https://github.com/synkron-panel/synkron
"""

import os
import re
import sys
import time
import threading
import webbrowser

import requests
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

__version__ = '1.0.0'

# ═══════════════════════════════════════════════
# APP SETUP
# ═══════════════════════════════════════════════

if getattr(sys, 'frozen', False):
    template_folder = os.path.join(sys._MEIPASS, 'templates')
    static_folder = os.path.join(sys._MEIPASS, 'static')
    app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
else:
    app = Flask(__name__)

load_dotenv()

CLIENT_ID = os.getenv('IKAS_CLIENT_ID')
CLIENT_SECRET = os.getenv('IKAS_CLIENT_SECRET')
STORE_SLUG = os.getenv('IKAS_STORE_SLUG', '')
AUTH_URL = os.getenv('IKAS_AUTH_URL', 'https://api.myikas.com/api/admin/oauth/token')
GRAPHQL_URL = os.getenv('IKAS_GRAPHQL_URL', 'https://api.myikas.com/api/v2/admin/graphql')

access_token = None

# ═══════════════════════════════════════════════
# ANALYSIS STATE (background worker)
# ═══════════════════════════════════════════════

analysis = {
    'status': 'idle',       # idle | running | done | error
    'progress': 0,
    'total_pages': 0,
    'fetched_pages': 0,
    'duplicates': [],
    'invalid_prefix': [],
    'duplicate_emails': [],
    'cities': [],
    'districts': [],
    'error': None
}

# ═══════════════════════════════════════════════
# AUTH
# ═══════════════════════════════════════════════

def get_token():
    """Obtain or reuse OAuth2 access token."""
    global access_token
    if access_token:
        return access_token
    data = {
        'grant_type': 'client_credentials',
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET
    }
    response = requests.post(AUTH_URL, data=data)
    if response.status_code == 200:
        access_token = response.json().get('access_token')
        return access_token
    raise Exception(f"Kimlik doğrulama hatası: {response.text}")

# ═══════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════

FIELDS = "id firstName lastName email phone createdAt addresses { city { name } district { name } }"


def process_addr(c):
    """Extract city and district from nested address data."""
    addresses = c.get('addresses') or []
    city = '-'
    district = '-'
    if addresses:
        a = addresses[0]
        vc = a.get('city')
        if vc:
            city = vc.get('name') or '-'
        vd = a.get('district')
        if vd:
            district = vd.get('name') or '-'
    c['city'] = city
    c['district'] = district


def _fetch_page(page, headers, limit=200, phone_empty=False):
    """Fetch a single page of customers from the GraphQL API.

    Args:
        page: Page number (1-indexed).
        headers: Auth headers dict.
        limit: Records per page.
        phone_empty: If True, filter for customers with empty phone.
    """
    if phone_empty:
        q = 'query($p:Int){listCustomer(phone:{eq:""},pagination:{limit:%d,page:$p}){data{%s}hasNext count}}' % (limit, FIELDS)
    else:
        q = 'query($p:Int){listCustomer(pagination:{limit:%d,page:$p}){data{%s}hasNext count}}' % (limit, FIELDS)
    res = requests.post(GRAPHQL_URL, json={'query': q, 'variables': {"p": page}}, headers=headers)
    if res.status_code == 200:
        d = res.json()
        if 'errors' in d:
            raise Exception(str(d['errors']))
        return d['data']['listCustomer']
    raise Exception(res.text)


def normalize_phone(phone):
    """Normalize Turkish phone numbers to +90XXXXXXXXXX format.

    Returns:
        tuple: (normalized_number, rule_description) or (None, None) if not fixable.

    Rules:
        5XXXXXXXXX   (10 digits)  → +905XXXXXXXXX
        05XXXXXXXXX  (11 digits)  → +905XXXXXXXXX
        905XXXXXXXXX (12 digits)  → +905XXXXXXXXX
    """
    if not phone:
        return None, None

    # Strip whitespace, dashes, parentheses
    phone = phone.strip().replace(' ', '').replace('-', '').replace('(', '').replace(')', '')

    # Already valid
    if re.match(r'^\+90[5]\d{9}$', phone):
        return phone, 'already_valid'

    # 5XXXXXXXXX → +905XXXXXXXXX
    if re.match(r'^5\d{9}$', phone):
        return '+90' + phone, '5XX → +905XX'

    # 05XXXXXXXXX → +905XXXXXXXXX (strip leading 0, prepend +90)
    if re.match(r'^05\d{9}$', phone):
        return '+90' + phone[1:], '05XX → +905XX'

    # 905XXXXXXXXX → +905XXXXXXXXX (prepend +)
    if re.match(r'^905\d{9}$', phone):
        return '+' + phone, '905XX → +905XX'

    return None, None

# ═══════════════════════════════════════════════
# BACKGROUND ANALYSIS
# ═══════════════════════════════════════════════

def run_analysis():
    """Fetch all customers and classify them for analysis."""
    global analysis
    analysis['status'] = 'running'
    analysis['progress'] = 0
    analysis['fetched_pages'] = 0
    analysis['error'] = None

    try:
        token = get_token()
        headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

        # First page to learn total count
        first = _fetch_page(1, headers, limit=200)
        total = first['count']
        total_pages = max(1, -(-total // 200))  # ceiling division
        analysis['total_pages'] = total_pages

        all_custs = list(first['data'])
        analysis['fetched_pages'] = 1
        analysis['progress'] = int(100 / total_pages)

        # Rate-limited sequential fetch (API limit: ~50 req / 10 sec)
        for pg in range(2, total_pages + 1):
            retries = 0
            while retries < 5:
                try:
                    result = _fetch_page(pg, headers, limit=200)
                    all_custs.extend(result['data'])
                    break
                except Exception as page_err:
                    if '429' in str(page_err) or 'Too Many' in str(page_err):
                        retries += 1
                        time.sleep(5 * retries)  # exponential backoff
                    else:
                        break  # skip page on other errors

            analysis['fetched_pages'] += 1
            analysis['progress'] = int((analysis['fetched_pages'] / total_pages) * 100)
            time.sleep(0.25)  # ~4 req/sec safe margin

        # Process & classify
        phone_map = {}
        email_map = {}
        invalid = []
        cities_set = set()
        districts_set = set()

        for c in all_custs:
            process_addr(c)
            cities_set.add(c['city'])
            districts_set.add(c['district'])

            phone = (c.get('phone') or '').strip()
            email = (c.get('email') or '').strip().lower()

            if phone:
                if not phone.startswith('+90'):
                    invalid.append(c)
                phone_map.setdefault(phone, []).append(c)

            if email:
                email_map.setdefault(email, []).append(c)

        dups = [c for custs in phone_map.values() if len(custs) > 1 for c in custs]
        dup_emails = [c for custs in email_map.values() if len(custs) > 1 for c in custs]

        analysis['duplicates'] = dups
        analysis['invalid_prefix'] = invalid
        analysis['duplicate_emails'] = dup_emails
        analysis['cities'] = sorted(cities_set)
        analysis['districts'] = sorted(districts_set)
        analysis['status'] = 'done'
        analysis['progress'] = 100

    except Exception as e:
        analysis['status'] = 'error'
        analysis['error'] = str(e)

# ═══════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════

@app.route('/')
def index():
    return render_template('index.html')


@app.after_request
def add_header(response):
    """Prevent caching to always serve fresh data."""
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response


@app.route('/api/stats')
def api_stats():
    """Fast count-only queries for dashboard stats."""
    try:
        token = get_token()
        h = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

        q1 = '{listCustomer(pagination:{limit:1,page:1}){count}}'
        r1 = requests.post(GRAPHQL_URL, json={'query': q1}, headers=h)
        total = r1.json()['data']['listCustomer']['count']

        q2 = '{listCustomer(phone:{eq:""},pagination:{limit:1,page:1}){count}}'
        r2 = requests.post(GRAPHQL_URL, json={'query': q2}, headers=h)
        missing = r2.json()['data']['listCustomer']['count']

        dup = len(analysis['duplicates']) if analysis['status'] == 'done' else '?'
        inv = len(analysis['invalid_prefix']) if analysis['status'] == 'done' else '?'
        dem = len(analysis['duplicate_emails']) if analysis['status'] == 'done' else '?'

        return jsonify(success=True, total=total, missing=missing,
                       duplicates=dup, invalid=inv, duplicate_emails=dem)
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


@app.route('/api/customers/all')
def api_all():
    """Paginated all-customers with optional search."""
    try:
        page = int(request.args.get('page', 1))
        search = request.args.get('search', '').strip()
        token = get_token()
        h = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

        if search:
            q = 'query($p:Int,$s:String){listCustomer(search:$s,pagination:{limit:50,page:$p}){data{%s}hasNext count}}' % FIELDS
            variables = {"p": page, "s": search}
        else:
            q = 'query($p:Int){listCustomer(pagination:{limit:50,page:$p}){data{%s}hasNext count}}' % FIELDS
            variables = {"p": page}

        res = requests.post(GRAPHQL_URL, json={'query': q, 'variables': variables}, headers=h)
        d = res.json()
        if 'errors' in d:
            raise Exception(str(d['errors']))
        result = d['data']['listCustomer']
        for c in result['data']:
            process_addr(c)
        return jsonify(success=True, data=result['data'], hasNext=result['hasNext'],
                       count=result['count'], page=page)
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


@app.route('/api/customers/missing')
def api_missing():
    """Customers with no phone number (server-filtered)."""
    try:
        page = int(request.args.get('page', 1))
        token = get_token()
        h = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        result = _fetch_page(page, h, limit=200, phone_empty=True)
        for c in result['data']:
            process_addr(c)
        return jsonify(success=True, data=result['data'], hasNext=result['hasNext'],
                       count=result['count'], page=page)
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


@app.route('/api/analyze', methods=['POST'])
def api_analyze():
    """Start background analysis."""
    if analysis['status'] == 'running':
        return jsonify(success=False, error='Analiz zaten devam ediyor.')
    # Reset state
    analysis['status'] = 'running'
    analysis['progress'] = 0
    analysis['fetched_pages'] = 0
    analysis['total_pages'] = 0
    analysis['error'] = None
    threading.Thread(target=run_analysis, daemon=True).start()
    return jsonify(success=True)


@app.route('/api/analyze/status')
def api_analyze_status():
    """Poll analysis progress."""
    r = {
        'status': analysis['status'],
        'progress': analysis['progress'],
        'fetched': analysis['fetched_pages'],
        'total': analysis['total_pages'],
        'error': analysis.get('error')
    }
    if analysis['status'] == 'done':
        r['dup_count'] = len(analysis['duplicates'])
        r['inv_count'] = len(analysis['invalid_prefix'])
        r['dem_count'] = len(analysis['duplicate_emails'])
    return jsonify(r)


@app.route('/api/analyze/results/<tab>')
def api_analyze_results(tab):
    """Paginated analysis results by tab (duplicates/invalid/emails)."""
    if analysis['status'] != 'done':
        return jsonify(success=False, error='Analiz henüz tamamlanmadı.'), 400
    page = int(request.args.get('page', 1))
    limit = 50
    mapping = {
        'duplicates': analysis['duplicates'],
        'invalid': analysis['invalid_prefix'],
        'emails': analysis['duplicate_emails']
    }
    arr = mapping.get(tab)
    if arr is None:
        return jsonify(success=False, error='Geçersiz sekme'), 400
    start = (page - 1) * limit
    end = start + limit
    return jsonify(success=True, data=arr[start:end], count=len(arr),
                   page=page, hasNext=end < len(arr),
                   cities=analysis.get('cities', []),
                   districts=analysis.get('districts', []))

# ═══════════════════════════════════════════════
# CUSTOMER OPERATIONS
# ═══════════════════════════════════════════════

@app.route('/api/update_phone', methods=['POST'])
def update_phone():
    """Manually update a customer's phone number."""
    try:
        data = request.json
        customer_id = data.get('id')
        new_phone = data.get('phone')
        if not customer_id:
            return jsonify(success=False, error='Customer ID gerekli'), 400
        token = get_token()
        h = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        mutation = """
        mutation UpdateCustomer($input: UpdateCustomerInput!) {
            updateCustomer(input: $input) { id phone updatedAt }
        }"""
        variables = {"input": {"id": customer_id, "phone": new_phone}}
        res = requests.post(GRAPHQL_URL, json={'query': mutation, 'variables': variables}, headers=h)
        if res.status_code == 200:
            rd = res.json()
            if 'errors' in rd:
                return jsonify(success=False, error=rd['errors'][0].get('message')), 400
            return jsonify(success=True, data=rd['data']['updateCustomer'])
        return jsonify(success=False, error=res.text), 400
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


@app.route('/api/delete_customers', methods=['POST'])
def delete_customers():
    """Delete one or more customers permanently."""
    try:
        data = request.json
        ids = data.get('ids', [])
        if not ids:
            return jsonify(success=False, error='Hiç müşteri seçilmedi.'), 400
        token = get_token()
        h = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        mutation = """
        mutation DeleteCustomerList($idList: [String!]!) {
            deleteCustomerList(idList: $idList)
        }"""
        res = requests.post(GRAPHQL_URL, json={'query': mutation, 'variables': {"idList": ids}}, headers=h)
        if res.status_code == 200:
            if 'errors' in res.json():
                return jsonify(success=False, error=res.json()['errors'][0].get('message')), 400
            return jsonify(success=True)
        return jsonify(success=False, error=res.text), 400
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500

# ═══════════════════════════════════════════════
# PHONE AUTO-FIX (automation)
# ═══════════════════════════════════════════════

@app.route('/api/auto_fix_phone', methods=['POST'])
def auto_fix_phone():
    """Auto-fix a single customer's phone number.

    Normalization rules:
        5XXXXXXXXX   → +905XXXXXXXXX
        05XXXXXXXXX  → +905XXXXXXXXX
        905XXXXXXXXX → +905XXXXXXXXX
    """
    try:
        data = request.json
        customer_id = data.get('id')
        if not customer_id:
            return jsonify(success=False, error='Customer ID gerekli'), 400

        # Find customer in analysis results
        customer = None
        for c in analysis.get('invalid_prefix', []):
            if c['id'] == customer_id:
                customer = c
                break

        if not customer:
            return jsonify(success=False, error='Müşteri bulunamadı'), 404

        old_phone = (customer.get('phone') or '').strip()
        new_phone, rule = normalize_phone(old_phone)

        if not new_phone or rule == 'already_valid':
            return jsonify(success=False, error='Bu numara otomatik düzeltilemez.'), 400

        # Final validation — paranoid check
        if not re.match(r'^\+90[5]\d{9}$', new_phone):
            return jsonify(success=False, error=f'Normalleştirme sonucu geçersiz: {new_phone}'), 400

        # Update via GraphQL mutation
        token = get_token()
        h = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        mutation = """
        mutation UpdateCustomer($input: UpdateCustomerInput!) {
            updateCustomer(input: $input) { id phone updatedAt }
        }"""
        variables = {"input": {"id": customer_id, "phone": new_phone}}
        res = requests.post(GRAPHQL_URL, json={'query': mutation, 'variables': variables}, headers=h)

        if res.status_code == 200:
            rd = res.json()
            if 'errors' in rd:
                return jsonify(success=False, error=rd['errors'][0].get('message')), 400

            # Remove from invalid list after successful fix
            analysis['invalid_prefix'] = [c for c in analysis['invalid_prefix'] if c['id'] != customer_id]

            return jsonify(success=True, old_phone=old_phone, new_phone=new_phone, rule=rule)
        return jsonify(success=False, error=res.text), 400
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500


@app.route('/api/bulk_auto_fix', methods=['POST'])
def bulk_auto_fix():
    """Auto-fix all fixable phone numbers from analysis results.

    Processes each invalid phone number, applies normalization rules,
    and updates via API with rate limiting.
    """
    try:
        if analysis['status'] != 'done':
            return jsonify(success=False, error='Önce analiz yapmalısınız.'), 400

        token = get_token()
        h = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        mutation = """
        mutation UpdateCustomer($input: UpdateCustomerInput!) {
            updateCustomer(input: $input) { id phone updatedAt }
        }"""

        fixed = 0
        skipped = 0
        errors = 0
        fixed_ids = []

        for c in list(analysis['invalid_prefix']):
            old_phone = (c.get('phone') or '').strip()
            new_phone, rule = normalize_phone(old_phone)

            # Skip if not fixable or already valid
            if not new_phone or rule == 'already_valid':
                skipped += 1
                continue

            # Paranoid validation
            if not re.match(r'^\+90[5]\d{9}$', new_phone):
                skipped += 1
                continue

            try:
                variables = {"input": {"id": c['id'], "phone": new_phone}}
                res = requests.post(GRAPHQL_URL, json={'query': mutation, 'variables': variables}, headers=h)

                if res.status_code == 200:
                    rd = res.json()
                    if 'errors' not in rd:
                        fixed += 1
                        fixed_ids.append(c['id'])
                    else:
                        errors += 1
                else:
                    errors += 1

                time.sleep(0.25)  # Rate limiting (~4 req/sec)
            except Exception:
                errors += 1

        # Remove fixed items from analysis
        analysis['invalid_prefix'] = [c for c in analysis['invalid_prefix'] if c['id'] not in fixed_ids]

        return jsonify(success=True, fixed=fixed, skipped=skipped, errors=errors)
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500

# ═══════════════════════════════════════════════
# SETTINGS
# ═══════════════════════════════════════════════

@app.route('/api/settings', methods=['GET', 'POST'])
def settings_handler():
    # Read or write API credentials to .env file.
    global CLIENT_ID, CLIENT_SECRET, STORE_SLUG, access_token

    if getattr(sys, 'frozen', False):
        env_path = os.path.join(os.path.dirname(sys.executable), '.env')
    else:
        env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')

    if request.method == 'GET':
        return jsonify(client_id=CLIENT_ID or '', client_secret=CLIENT_SECRET or '', store_slug=STORE_SLUG or '')

    data = request.json
    cid = data.get('client_id', '')
    csecret = data.get('client_secret', '')
    slug = data.get('store_slug', '')
    try:
        with open(env_path, 'w') as f:
            f.write(f"IKAS_CLIENT_ID={cid}\n")
            f.write(f"IKAS_CLIENT_SECRET={csecret}\n")
            f.write(f"IKAS_STORE_SLUG={slug}\n")
            f.write(f"IKAS_AUTH_URL={AUTH_URL}\n")
            f.write(f"IKAS_GRAPHQL_URL={GRAPHQL_URL}\n")
        CLIENT_ID = cid
        CLIENT_SECRET = csecret
        STORE_SLUG = slug
        access_token = None
        return jsonify(success=True)
    except Exception as e:
        return jsonify(success=False, error=str(e)), 500

# ═══════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════

def open_browser():
    """Open the app in the default browser after server starts."""
    time.sleep(1.5)
    webbrowser.open('http://127.0.0.1:5001')


if __name__ == '__main__':
    threading.Thread(target=open_browser, daemon=True).start()
    app.run(debug=False, port=5001)
