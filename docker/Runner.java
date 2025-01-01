import java.io.*;
import java.util.*;
import javax.tools.*;

public class Runner {
    public static void main(String[] args) {
        try {
            if (args.length == 0) {
                System.err.println("No code provided");
                System.exit(1);
            }

            // Remove surrounding quotes and unescape the code
            String code = args[0];
            if (code.startsWith("\"") && code.endsWith("\"")) {
                code = code.substring(1, code.length() - 1);
            }
            code = code.replace("\\n", "\n")
                      .replace("\\r", "\r")
                      .replace("\\t", "\t")
                      .replace("\\\"", "\"")
                      .replace("\\\\", "\\");
            
            // Extract the class name from the code
            String className = extractClassName(code);
            if (className == null) {
                className = "Main";
                // Wrap the code in a Main class if it doesn't have a class definition
                code = "public class Main { public static void main(String[] args) { " + code + " } }";
            }

            // Create source file
            File sourceFile = new File(className + ".java");
            try (PrintWriter writer = new PrintWriter(new FileWriter(sourceFile))) {
                writer.write(code);
            }

            // Compile the code
            JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
            DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
            StandardJavaFileManager fileManager = compiler.getStandardFileManager(diagnostics, null, null);
            
            Iterable<? extends JavaFileObject> compilationUnits = fileManager.getJavaFileObjectsFromFiles(Arrays.asList(sourceFile));
            JavaCompiler.CompilationTask task = compiler.getTask(null, fileManager, diagnostics, null, null, compilationUnits);

            boolean success = task.call();
            if (!success) {
                StringBuilder errors = new StringBuilder();
                for (Diagnostic<? extends JavaFileObject> diagnostic : diagnostics.getDiagnostics()) {
                    errors.append(diagnostic.getMessage(null)).append("\n");
                }
                System.err.println(errors.toString());
                System.exit(1);
            }

            // Run the compiled code in a separate process
            ProcessBuilder pb = new ProcessBuilder("java", className);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            // Read the output
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    System.out.println(line);
                }
            }

            int exitCode = process.waitFor();
            System.exit(exitCode);

        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }

    private static String extractClassName(String code) {
        // Simple regex to extract class name
        String[] lines = code.split("\n");
        for (String line : lines) {
            line = line.trim();
            if (line.startsWith("public class ")) {
                return line.split(" ")[2].split("\\{")[0].trim();
            }
        }
        return null;
    }
}
