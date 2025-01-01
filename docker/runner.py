import sys
import json
import time
from io import StringIO
from contextlib import redirect_stdout, redirect_stderr

def execute_code(code_str):
    start_time = time.time()
    stdout = StringIO()
    stderr = StringIO()
    
    try:
        with redirect_stdout(stdout), redirect_stderr(stderr):
            exec(code_str)
        status = "success"
    except Exception as e:
        print(str(e), file=sys.stderr)
        status = "failure"
    
    execution_time = f"{time.time() - start_time:.3f}s"
    
    return {
        "stdout": stdout.getvalue(),
        "stderr": stderr.getvalue(),
        "executionTime": execution_time,
        "status": status
    }

if __name__ == "__main__":
    # Read code from stdin
    code = sys.stdin.read()
    result = execute_code(code)
    print(json.dumps(result))
