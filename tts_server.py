import http.server
import socketserver
import json
import subprocess
import base64
import os
import uuid

class TTSHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/test-tts':
            print("POST 요청 받음")
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))

                text = data.get('text', '안녕하세요')
                voice = data.get('voice', 'ko-KR-SunHiNeural')
                rate = data.get('rate', '0')
                pitch = data.get('pitch', '0')

                print(f"파라미터: text={text}, voice={voice}, rate={rate}, pitch={pitch}")

                # 고유한 파일명 생성
                file_name = f'{uuid.uuid4()}.mp3'
                output_path = f'/tmp/{file_name}'

                # rate와 pitch를 정수로 변환
                rate_int = int(float(rate))
                pitch_int = int(float(pitch))

                # edge-tts 명령어 실행
                command = [
                    'edge-tts',
                    '--text', text,
                    '--voice', voice,
                    '--rate', f'{rate_int:+d}%',
                    '--pitch', f'{pitch_int:+d}Hz',
                    '--write-media', output_path
                ]

                print(f"명령어 실행: {' '.join(command)}")
                result = subprocess.run(command, capture_output=True, text=True)

                if result.returncode == 0 and os.path.exists(output_path):
                    print("TTS 성공")
                    with open(output_path, 'rb') as f:
                        audio_data = f.read()

                    audio_base64 = base64.b64encode(audio_data).decode('utf-8')
                    os.remove(output_path)

                    response = {
                        'success': True,
                        'audio': audio_base64,
                        'size': len(audio_data)
                    }
                else:
                    print(f"TTS 실패: {result.stderr}")
                    response = {'success': False, 'error': f'TTS failed: {result.stderr}'}

            except Exception as e:
                print(f"예외: {str(e)}")
                response = {'success': False, 'error': str(e)}

            try:
                response_json = json.dumps(response, ensure_ascii=False)
                print(f"응답 전송: {len(response_json)} 문자")
                self.wfile.write(response_json.encode('utf-8'))
                print("응답 전송 완료")
            except Exception as e:
                print(f"응답 전송 실패: {str(e)}")
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.end_headers()

if __name__ == '__main__':
    with socketserver.TCPServer(('', 5003), TTSHandler) as httpd:
        print('TTS API 서버 실행 중: http://localhost:5003')
        httpd.serve_forever()