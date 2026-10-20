path = "/usr/share/novnc/app/error-handler.js"
try:
    with open(path, "r") as f:
        content = f.read()

    target = "function handleError(event, err) {"
    replacement = """function handleError(event, err) {
        if (!event) return false;
        var src = (event.filename || "") + " " + (event.message || "") + " " + (err && err.stack || "");
        if (src.indexOf("chrome-extension:") !== -1 || src.indexOf("moz-extension:") !== -1 || src.indexOf("MetaMask") !== -1) {
            return false;
        }"""

    if target in content and "chrome-extension:" not in content:
        content = content.replace(target, replacement, 1)
        with open(path, "w") as f:
            f.write(content)
        print("Successfully patched error-handler.js")
    else:
        print("Already patched or target not found")
except Exception as e:
    print(f"Error: {e}")
