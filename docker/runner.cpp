#include <iostream>
#include <sstream>
#include <chrono>
#include <ctime>
#include <string>
#include <fstream>

struct ExecutionResult {
    std::string stdout;
    std::string stderr;
    std::string executionTime;
    std::string status;
};

std::string escapeJson(const std::string& str) {
    std::stringstream ss;
    for (char c : str) {
        switch (c) {
            case '\"': ss << "\\\""; break;
            case '\\': ss << "\\\\"; break;
            case '\b': ss << "\\b"; break;
            case '\f': ss << "\\f"; break;
            case '\n': ss << "\\n"; break;
            case '\r': ss << "\\r"; break;
            case '\t': ss << "\\t"; break;
            default:
                if ('\x00' <= c && c <= '\x1f') {
                    ss << "\\u" << std::hex << std::uppercase << (int)c;
                } else {
                    ss << c;
                }
        }
    }
    return ss.str();
}

int main() {
    // Read code from stdin
    std::stringstream buffer;
    buffer << std::cin.rdbuf();
    std::string code = buffer.str();

    // Create a temporary file for the code
    std::string tempFileName = "temp_code.cpp";
    std::ofstream tempFile(tempFileName);
    tempFile << code;
    tempFile.close();

    auto start = std::chrono::high_resolution_clock::now();
    
    // Compile and execute the code
    ExecutionResult result;
    
    // Compile
    std::string compileCmd = "g++ -o temp_executable " + tempFileName + " 2>&1";
    FILE* pipe = popen(compileCmd.c_str(), "r");
    if (!pipe) {
        result.status = "failure";
        result.stderr = "Failed to compile";
    } else {
        char buffer[128];
        std::string compileOutput;
        while (fgets(buffer, sizeof(buffer), pipe) != NULL) {
            compileOutput += buffer;
        }
        int compileStatus = pclose(pipe);

        if (compileStatus != 0) {
            result.status = "failure";
            result.stderr = compileOutput;
        } else {
            // Execute
            pipe = popen("./temp_executable 2>&1", "r");
            if (!pipe) {
                result.status = "failure";
                result.stderr = "Failed to execute";
            } else {
                std::string output;
                while (fgets(buffer, sizeof(buffer), pipe) != NULL) {
                    output += buffer;
                }
                int execStatus = pclose(pipe);

                if (execStatus != 0) {
                    result.status = "failure";
                    result.stderr = output;
                } else {
                    result.status = "success";
                    result.stdout = output;
                }
            }
        }
    }

    auto end = std::chrono::high_resolution_clock::now();
    std::chrono::duration<double> diff = end - start;
    
    result.executionTime = std::to_string(diff.count()) + "s";

    // Output result as JSON
    std::cout << "{" 
              << "\"stdout\":\"" << escapeJson(result.stdout) << "\","
              << "\"stderr\":\"" << escapeJson(result.stderr) << "\","
              << "\"executionTime\":\"" << result.executionTime << "\","
              << "\"status\":\"" << result.status << "\""
              << "}" << std::endl;

    // Cleanup
    std::remove(tempFileName.c_str());
    std::remove("temp_executable");

    return 0;
}
