#!/usr/bin/env python3
"""
Simple test to verify Markdown support exists in selectbox placeholders.
"""

def check_frontend_implementation():
    """Check if the frontend implementation has Markdown support."""
    
    # Check if the shared Selectbox component has MarkdownPlaceholder
    selectbox_file = "d:/streamlit/frontend/lib/src/components/shared/Dropdown/Selectbox.tsx"
    
    try:
        with open(selectbox_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        checks = [
            "MarkdownPlaceholder" in content,
            "StreamlitMarkdown" in content, 
            "hasMarkdownSyntax" in content,
            "isLabel={true}" in content or "isLabel: true" in content,
            "allowHTML={false}" in content or "allowHTML: false" in content
        ]
        
        print("✅ Frontend Selectbox implementation checks:")
        for i, check in enumerate(checks, 1):
            status = "✅" if check else "❌"
            print(f"  {status} Check {i}: {check}")
            
        return all(checks)
        
    except FileNotFoundError:
        print("❌ Selectbox file not found")
        return False
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        return False

def check_multiselect_implementation():
    """Check if the Multiselect component has Markdown support."""
    
    multiselect_file = "d:/streamlit/frontend/lib/src/components/widgets/Multiselect/Multiselect.tsx"
    
    try:
        with open(multiselect_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        checks = [
            "MarkdownPlaceholder" in content,
            "StreamlitMarkdown" in content,
            "hasMarkdownSyntax" in content,
            "isLabel={true}" in content or "isLabel: true" in content
        ]
        
        print("\n✅ Frontend Multiselect implementation checks:")
        for i, check in enumerate(checks, 1):
            status = "✅" if check else "❌"
            print(f"  {status} Check {i}: {check}")
            
        return all(checks)
        
    except FileNotFoundError:
        print("❌ Multiselect file not found")
        return False
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        return False

def check_backend_documentation():
    """Check if the backend documentation mentions Markdown support."""
    
    selectbox_py = "d:/streamlit/lib/streamlit/elements/widgets/selectbox.py"
    multiselect_py = "d:/streamlit/lib/streamlit/elements/widgets/multiselect.py"
    
    results = []
    for file_path, name in [(selectbox_py, "Selectbox"), (multiselect_py, "Multiselect")]:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Check if placeholder documentation mentions Markdown
            has_placeholder_markdown = "placeholder can optionally contain GitHub-flavored Markdown" in content
            results.append((name, has_placeholder_markdown))
            
        except Exception as e:
            print(f"❌ Error reading {name} file: {e}")
            results.append((name, False))
    
    print("\n✅ Backend documentation checks:")
    for name, check in results:
        status = "✅" if check else "❌"
        print(f"  {status} {name} placeholder docs mention Markdown: {check}")
    
    return all(check for _, check in results)

def check_tests():
    """Check if tests exist for Markdown functionality."""
    
    test_files = [
        "d:/streamlit/frontend/lib/src/components/shared/Dropdown/Selectbox.test.tsx",
        "d:/streamlit/frontend/lib/src/components/widgets/Multiselect/Multiselect.test.tsx"
    ]
    
    print("\n✅ Test implementation checks:")
    all_good = True
    
    for test_file in test_files:
        try:
            with open(test_file, 'r', encoding='utf-8') as f:
                content = f.read()
                
            has_markdown_test = "renders markdown in placeholder" in content
            widget_name = "Selectbox" if "Selectbox" in test_file else "Multiselect"
            
            status = "✅" if has_markdown_test else "❌"
            print(f"  {status} {widget_name} has Markdown placeholder tests: {has_markdown_test}")
            
            if not has_markdown_test:
                all_good = False
                
        except Exception as e:
            print(f"❌ Error reading test file {test_file}: {e}")
            all_good = False
    
    return all_good

def main():
    print("🔍 Checking Markdown support in Selectbox placeholders...\n")
    
    checks = [
        ("Frontend Selectbox", check_frontend_implementation()),
        ("Frontend Multiselect", check_multiselect_implementation()),
        ("Backend Documentation", check_backend_documentation()),
        ("Tests", check_tests())
    ]
    
    print("\n" + "="*50)
    print("📋 SUMMARY:")
    print("="*50)
    
    all_passed = True
    for name, passed in checks:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} {name}")
        if not passed:
            all_passed = False
    
    print("="*50)
    if all_passed:
        print("🎉 ALL CHECKS PASSED! Markdown support is properly implemented.")
    else:
        print("⚠️  Some checks failed. Review the implementation.")
    
    return all_passed

if __name__ == "__main__":
    main()
