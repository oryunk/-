from flask import Flask, request, jsonify
import threading
import time

app = Flask(__name__)

@app.route('/api/terms/explain', methods=['POST'])
def explain():
    data = request.json
    term = data.get('term', '')
    if term == 'PER':
        return jsonify({"explanation": "Price-to-Earnings Ratio (二쇨?tv씡鍮꾩쑉)"})
    return jsonify({"explanation": "Unknown term"})

def run_server():
    app.run(port=5000)

thread = threading.Thread(target=run_server)
thread.daemon = True
thread.start()

time.sleep(2) # Wait for server to start

import requests
try:
    response = requests.post('http://127.0.0.1:5000/api/terms/explain', json={'term': 'PER'})
    print(f'CODE:{response.status_code}')
    print(f'BODY:{response.text}')
except Exception as e:
    print(f'ERROR:{e}')
