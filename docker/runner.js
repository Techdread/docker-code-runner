const vm = require('vm');

async function executeCode(code) {
    const startTime = process.hrtime();
    const context = {};
    
    try {
        // Create a new context for code execution
        vm.createContext(context);
        
        // Execute the code
        vm.runInContext(code, context);
        
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const executionTime = `${seconds}.${Math.floor(nanoseconds / 1000000)}s`;
        
        return {
            stdout: '',  // Captured through console.log redirection
            stderr: '',
            executionTime,
            status: 'success'
        };
    } catch (error) {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const executionTime = `${seconds}.${Math.floor(nanoseconds / 1000000)}s`;
        
        return {
            stdout: '',
            stderr: error.message,
            executionTime,
            status: 'failure'
        };
    }
}

// Read input from stdin
let code = '';
process.stdin.on('data', chunk => {
    code += chunk;
});

process.stdin.on('end', async () => {
    const result = await executeCode(code);
    console.log(JSON.stringify(result));
});
