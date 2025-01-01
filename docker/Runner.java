import java.io.*;
import java.util.*;
import javax.tools.*;

public class Runner {
    public static void main(String[] args) {
        try {
            System.err.println("[DEBUG] Runner started");
            
            if (args.length == 0) {
                System.err.println("No code provided");
                System.exit(1);
            }

            // Remove surrounding quotes and unescape the code
            String code = args[0];
            System.err.println("[DEBUG] Received code: " + code.substring(0, Math.min(50, code.length())) + "...");
            
            if (code.startsWith("\"") && code.endsWith("\"")) {
                code = code.substring(1, code.length() - 1);
                System.err.println("[DEBUG] Removed quotes from code");
            }
            
            // Get user input if provided as second argument
            String userInput = "";
            if (args.length > 1) {
                userInput = args[1];
                if (userInput.startsWith("\"") && userInput.endsWith("\"")) {
                    userInput = userInput.substring(1, userInput.length() - 1);
                }
                System.err.println("[DEBUG] User input (without quotes): " + userInput);
            }
            
            code = code.replace("\\n", "\n")
                      .replace("\\r", "\r")
                      .replace("\\t", "\t")
                      .replace("\\\"", "\"")
                      .replace("\\\\", "\\");
            
            System.err.println("[DEBUG] Unescaped code: " + code.substring(0, Math.min(50, code.length())) + "...");
            
            // Extract the class name from the code
            String className = extractClassName(code);
            if (className == null) {
                className = "Main";
                // Wrap the code in a Main class if it doesn't have a class definition
                code = "public class Main { public static void main(String[] args) { " + code + " } }";
                System.err.println("[DEBUG] Wrapped code in Main class");
            } else {
                System.err.println("[DEBUG] Found class name: " + className);
                // If the class is not public, make it public
                if (!code.contains("public class " + className)) {
                    code = code.replace("class " + className, "public class " + className);
                    System.err.println("[DEBUG] Made class public: " + className);
                }
            }

            // Create source file
            File sourceFile = new File(className + ".java");
            try (PrintWriter writer = new PrintWriter(new FileWriter(sourceFile))) {
                writer.write(code);
                System.err.println("[DEBUG] Wrote source file: " + sourceFile.getAbsolutePath());
                System.err.println("[DEBUG] File contents:\n" + code);
            }

            // Compile the code
            JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
            DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
            StandardJavaFileManager fileManager = compiler.getStandardFileManager(diagnostics, null, null);
            
            System.err.println("[DEBUG] Starting compilation");
            
            Iterable<? extends JavaFileObject> compilationUnits = fileManager.getJavaFileObjectsFromFiles(Arrays.asList(sourceFile));
            JavaCompiler.CompilationTask task = compiler.getTask(null, fileManager, diagnostics, null, null, compilationUnits);

            boolean success = task.call();
            if (!success) {
                StringBuilder errors = new StringBuilder();
                for (Diagnostic<? extends JavaFileObject> diagnostic : diagnostics.getDiagnostics()) {
                    errors.append(diagnostic.getMessage(null)).append("\n");
                }
                System.err.println("[DEBUG] Compilation failed: " + errors.toString());
                System.exit(1);
            }
            
            System.err.println("[DEBUG] Compilation successful");

            // Run the compiled code in a separate process
            System.err.println("[DEBUG] Starting execution of " + className);
            ProcessBuilder pb = new ProcessBuilder("java", className);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            // If we have user input, send it to the process
            if (!userInput.isEmpty()) {
                System.err.println("[DEBUG] Sending user input: " + userInput);
                try (PrintWriter pw = new PrintWriter(process.getOutputStream())) {
                    pw.println(userInput);
                    pw.flush();
                }
            }

            // Read the output
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    System.out.println(line);
                    System.err.println("[DEBUG] Output line: " + line);
                }
            }

            int exitCode = process.waitFor();
            System.err.println("[DEBUG] Process exited with code: " + exitCode);
            System.exit(exitCode);

        } catch (Exception e) {
            System.err.println("[DEBUG] Error occurred: " + e.getClass().getName() + ": " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }

    private static String extractClassName(String code) {
        // Simple regex to extract class name
        String[] lines = code.split("\n");
        for (String line : lines) {
            line = line.trim();
            if (line.startsWith("class ") || line.startsWith("public class ")) {
                String[] parts = line.split(" ");
                for (int i = 0; i < parts.length; i++) {
                    if (parts[i].equals("class") && i + 1 < parts.length) {
                        return parts[i + 1].split("\\{")[0].trim();
                    }
                }
            }
        }
        return null;
    }
}
