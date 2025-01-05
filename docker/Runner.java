import java.io.*;
import java.util.*;
import javax.tools.*;

public class Runner {
    private static class CodeAnalyzer {
        private final String code;
        private final List<String> imports;
        private final Map<String, String> classes;
        private String mainClassName;
        
        public CodeAnalyzer(String code) {
            this.code = code;
            this.imports = new ArrayList<>();
            this.classes = new HashMap<>();
            analyze();
        }
        
        private void analyze() {
            Scanner scanner = new Scanner(code);
            StringBuilder currentClass = new StringBuilder();
            String currentClassName = null;
            int braceCount = 0;
            boolean inClass = false;
            StringBuilder lineBuffer = new StringBuilder();
            
            while (scanner.hasNextLine()) {
                String line = scanner.nextLine();
                String trimmedLine = line.trim();
                
                if (trimmedLine.startsWith("import ")) {
                    imports.add(line);
                    continue;
                }
                
                // Handle class detection
                if (trimmedLine.contains("class ")) {
                    if (currentClassName != null && inClass) {
                        classes.put(currentClassName, currentClass.toString());
                        currentClass = new StringBuilder();
                    }
                    currentClassName = extractClassName(trimmedLine);
                    inClass = true;
                    currentClass.append(line).append("\n");
                    braceCount += countChar(line, '{');
                } else if (inClass) {
                    currentClass.append(line).append("\n");
                    braceCount += countChar(line, '{');
                    braceCount -= countChar(line, '}');
                    
                    if (braceCount == 0 && currentClassName != null) {
                        // Ensure we have a complete class definition
                        String classContent = currentClass.toString().trim();
                        if (classContent.endsWith("}")) {
                            classes.put(currentClassName, currentClass.toString());
                            currentClass = new StringBuilder();
                            currentClassName = null;
                            inClass = false;
                        }
                    }
                }
                
                // Check for main method
                if (trimmedLine.contains("public static void main(String")) {
                    if (currentClassName != null) {
                        mainClassName = currentClassName;
                    }
                }
            }
            
            // Handle the last class if any
            if (currentClassName != null && inClass) {
                String classContent = currentClass.toString().trim();
                if (classContent.endsWith("}")) {
                    classes.put(currentClassName, currentClass.toString());
                }
            }
            
            scanner.close();
        }
        
        private int countChar(String str, char ch) {
            int count = 0;
            for (int i = 0; i < str.length(); i++) {
                if (str.charAt(i) == ch) {
                    // Don't count braces in comments
                    if (ch == '{' || ch == '}') {
                        String beforeChar = str.substring(0, i).trim();
                        if (!beforeChar.endsWith("//") && !isInMultiLineComment(str, i)) {
                            count++;
                        }
                    } else {
                        count++;
                    }
                }
            }
            return count;
        }
        
        private boolean isInMultiLineComment(String str, int pos) {
            int lastComment = str.lastIndexOf("/*", pos);
            if (lastComment == -1) return false;
            int lastCommentEnd = str.lastIndexOf("*/", pos);
            return lastCommentEnd < lastComment;
        }
        
        private String extractClassName(String line) {
            // Remove any comments first
            int commentIndex = line.indexOf("//");
            if (commentIndex >= 0) {
                line = line.substring(0, commentIndex);
            }
            
            // Handle both inline and newline cases for class declaration
            String[] parts = line.split("\\s+");
            for (int i = 0; i < parts.length; i++) {
                if (parts[i].equals("class") && i + 1 < parts.length) {
                    String className = parts[i + 1];
                    // Remove any { or whitespace if present
                    return className.split("[{\\s]")[0].trim();
                }
            }
            return null;
        }
        
        public boolean hasClasses() {
            return !classes.isEmpty();
        }
        
        public boolean hasMainClass() {
            return mainClassName != null;
        }
        
        public List<File> createSourceFiles() throws IOException {
            List<File> sourceFiles = new ArrayList<>();
            
            if (!hasClasses()) {
                // Case 1: Plain code without class
                String wrappedCode = String.join("\n", imports) +
                    "\npublic class Main {\n" +
                    "    public static void main(String[] args) {\n" +
                    "        " + code + "\n" +
                    "    }\n" +
                    "}\n";
                File mainFile = new File("Main.java");
                try (PrintWriter writer = new PrintWriter(new FileWriter(mainFile))) {
                    writer.write(wrappedCode);
                    sourceFiles.add(mainFile);
                    System.err.println("[DEBUG] Created Main.java for plain code");
                }
                mainClassName = "Main";
                return sourceFiles;
            }
            
            // Case 2 & 3: Single class or multiple classes
            String importsStr = String.join("\n", imports) + "\n";
            
            for (Map.Entry<String, String> entry : classes.entrySet()) {
                String className = entry.getKey();
                String classCode = entry.getValue();
                
                // Make the class public if it contains main or is the only class
                if ((className.equals(mainClassName) || classes.size() == 1) && 
                    !classCode.contains("public class")) {
                    classCode = classCode.replace("class " + className, "public class " + className);
                }
                
                File sourceFile = new File(className + ".java");
                try (PrintWriter writer = new PrintWriter(new FileWriter(sourceFile))) {
                    writer.write(importsStr + classCode);
                    sourceFiles.add(sourceFile);
                    System.err.println("[DEBUG] Created " + className + ".java with contents:\n" + importsStr + classCode);
                }
            }
            
            return sourceFiles;
        }
        
        public String getMainClassName() {
            return mainClassName != null ? mainClassName : 
                   classes.size() == 1 ? classes.keySet().iterator().next() : "Main";
        }
    }

    public static void main(String[] args) {
        try {
            System.err.println("[DEBUG] Runner started");
            
            if (args.length == 0) {
                System.err.println("No code provided");
                System.exit(1);
            }

            String code = args[0];
            System.err.println("[DEBUG] Received code: " + code.substring(0, Math.min(50, code.length())) + "...");
            
            if (code.startsWith("\"") && code.endsWith("\"")) {
                code = code.substring(1, code.length() - 1);
                System.err.println("[DEBUG] Removed quotes from code");
            }
            
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
            
            // Analyze and process the code
            CodeAnalyzer analyzer = new CodeAnalyzer(code);
            List<File> sourceFiles = analyzer.createSourceFiles();
            String mainClassName = analyzer.getMainClassName();

            // Compile all source files
            JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
            DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
            StandardJavaFileManager fileManager = compiler.getStandardFileManager(diagnostics, null, null);
            
            System.err.println("[DEBUG] Starting compilation");
            
            Iterable<? extends JavaFileObject> compilationUnits = fileManager.getJavaFileObjectsFromFiles(sourceFiles);
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

            // Run the compiled code
            System.err.println("[DEBUG] Starting execution of " + mainClassName);
            ProcessBuilder pb = new ProcessBuilder("java", mainClassName);
            pb.redirectErrorStream(true);
            Process process = pb.start();

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
                }
            }

            // Wait for the process to complete
            int exitCode = process.waitFor();
            System.err.println("[DEBUG] Process exited with code " + exitCode);
            System.exit(exitCode);

        } catch (Exception e) {
            System.err.println("[DEBUG] Error: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}
