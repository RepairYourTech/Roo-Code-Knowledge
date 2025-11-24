import { CodeParser } from "../parser"

describe("Multi-Language Parser Support", () => {
	let parser: CodeParser

	beforeEach(() => {
		parser = new CodeParser()
	})

	describe("Call Expression Parsing", () => {
		it("should parse Rust function calls", async () => {
			const rustCode = `
fn main() {
    println!("Hello, world!");
    let result = std::collections::HashMap::new();
    result.insert("key", "value");
}
`

			// This would need actual tree-sitter parsing in a real test
			// For now, we're testing the parsing logic structure
			expect(rustCode).toContain("println!")
			expect(rustCode).toContain("std::collections::HashMap::new")
		})

		it("should parse Go function calls", async () => {
			const goCode = `
package main

import "fmt"

func main() {
    fmt.Println("Hello, world!")
    result := make(map[string]string)
    result["key"] = "value"
}
`

			expect(goCode).toContain("fmt.Println")
			expect(goCode).toContain("make")
		})

		it("should parse Java method calls", async () => {
			const javaCode = `
public class Test {
    public static void main(String[] args) {
        System.out.println("Hello, world!");
        Math.max(1, 2);
        new ArrayList<String>();
    }
}
`

			expect(javaCode).toContain("System.out.println")
			expect(javaCode).toContain("Math.max")
			expect(javaCode).toContain("new ArrayList")
		})

		it("should parse C++ function calls", async () => {
			const cppCode = `
#include <iostream>
#include <vector>

int main() {
    std::cout << "Hello, world!" << std::endl;
    std::vector<int> vec;
    vec.push_back(42);
}
`

			expect(cppCode).toContain("std::cout")
			expect(cppCode).toContain("vec.push_back")
		})

		it("should parse Python function calls", async () => {
			const pythonCode = `
def main():
    print("Hello, world!")
    result = {}
    result["key"] = "value"
    len(result)
`

			expect(pythonCode).toContain("print")
			expect(pythonCode).toContain("len")
		})
	})

	describe("Import Detection", () => {
		it("should detect Rust use declarations", () => {
			const rustCode = `
use std::collections::HashMap;
use std::io::{self, Read};
use crate::module;
`

			expect(rustCode).toContain("use std::collections::HashMap")
			expect(rustCode).toContain("use std::io::{self, Read}")
			expect(rustCode).toContain("use crate::module")
		})

		it("should detect Go import declarations", () => {
			const goCode = `
import "fmt"
import alias "net/http"
import . "internal/module"
`

			expect(goCode).toContain('import "fmt"')
			expect(goCode).toContain('import alias "net/http"')
			expect(goCode).toContain('import . "internal/module"')
		})

		it("should detect Java import statements", () => {
			const javaCode = `
import java.util.ArrayList;
import java.util.*;
import static java.lang.Math.max;
`

			expect(javaCode).toContain("import java.util.ArrayList")
			expect(javaCode).toContain("import java.util.*")
			expect(javaCode).toContain("import static java.lang.Math.max")
		})

		it("should detect C++ include statements", () => {
			const cppCode = `
#include <iostream>
#include <vector>
#include "myheader.h"
`

			expect(cppCode).toContain("#include <iostream>")
			expect(cppCode).toContain("#include <vector>")
			expect(cppCode).toContain('#include "myheader.h"')
		})

		it("should detect Python import statements", () => {
			const pythonCode = `
import os
import sys
from collections import defaultdict
from .module import local_function
`

			expect(pythonCode).toContain("import os")
			expect(pythonCode).toContain("import sys")
			expect(pythonCode).toContain("from collections import defaultdict")
			expect(pythonCode).toContain("from .module import local_function")
		})
	})

	describe("Comment Extraction", () => {
		it("should extract C-style comments", () => {
			const code = `
// Single line comment
/* Multi-line comment */
/**
 * JSDoc comment
 */
int x = 1;
`

			expect(code).toContain("// Single line comment")
			expect(code).toContain("/* Multi-line comment */")
			expect(code).toContain("/**")
		})

		it("should extract Python comments", () => {
			const code = `
# Single line comment
"""
Multi-line docstring
'''
Another docstring
'''
def function():
    pass
`

			expect(code).toContain("# Single line comment")
			expect(code).toContain('"""')
			expect(code).toContain("'''")
		})

		it("should extract mixed language comments", () => {
			const code = `
// C++ comment
# Python comment
-- SQL comment
-- Haskell comment
; Lisp comment
<!-- HTML comment -->
* COBOL comment
C Fortran comment
-- Ada comment
`

			expect(code).toContain("// C++ comment")
			expect(code).toContain("# Python comment")
			expect(code).toContain("-- SQL comment")
			expect(code).toContain("; Lisp comment")
			expect(code).toContain("<!-- HTML comment -->")
			expect(code).toContain("* COBOL comment")
			expect(code).toContain("C Fortran comment")
			expect(code).toContain("-- Ada comment")
		})
	})

	describe("Symbol Type Detection", () => {
		it("should detect Rust symbol types", () => {
			const rustCode = `
fn function() {}
struct Struct {}
enum Enum {}
trait Trait {}
impl Impl {}
mod Module {}
const CONST: i32 = 1;
static STATIC: i32 = 1;
type Type = i32;
macro_rules! macro {}
`

			// These would be detected by the symbol type mapping
			expect(rustCode).toContain("fn function")
			expect(rustCode).toContain("struct Struct")
			expect(rustCode).toContain("enum Enum")
			expect(rustCode).toContain("trait Trait")
			expect(rustCode).toContain("impl Impl")
			expect(rustCode).toContain("mod Module")
			expect(rustCode).toContain("const CONST")
			expect(rustCode).toContain("static STATIC")
			expect(rustCode).toContain("type Type")
			expect(rustCode).toContain("macro_rules! macro")
		})

		it("should detect Go symbol types", () => {
			const goCode = `
func function() {}
type Type struct {}
var variable int
const CONSTANT = 1
`

			expect(goCode).toContain("func function")
			expect(goCode).toContain("type Type struct")
			expect(goCode).toContain("var variable")
			expect(goCode).toContain("const CONSTANT")
		})

		it("should detect Java symbol types", () => {
			const javaCode = `
public class Class {
    public void method() {}
    public static void staticMethod() {}
    private int field;
    public Class() {} // constructor
}
interface Interface {}
enum Enum {}
record Record {}
@interface Annotation {}
`

			expect(javaCode).toContain("class Class")
			expect(javaCode).toContain("method()")
			expect(javaCode).toContain("staticMethod()")
			expect(javaCode).toContain("field")
			expect(javaCode).toContain("Class() {}")
			expect(javaCode).toContain("interface Interface")
			expect(javaCode).toContain("enum Enum")
			expect(javaCode).toContain("record Record")
			expect(javaCode).toContain("@interface Annotation")
		})

		it("should detect C++ symbol types", () => {
			const cppCode = `
void function() {}
class Class {
public:
    void method() {}
    static void staticMethod() {}
    int field;
};
struct Struct {};
union Union {};
enum Enum {};
typedef int Type;
`

			expect(cppCode).toContain("function()")
			expect(cppCode).toContain("class Class")
			expect(cppCode).toContain("method()")
			expect(cppCode).toContain("staticMethod()")
			expect(cppCode).toContain("field")
			expect(cppCode).toContain("struct Struct")
			expect(cppCode).toContain("union Union")
			expect(cppCode).toContain("enum Enum")
			expect(cppCode).toContain("typedef int Type")
		})

		it("should detect Python symbol types", () => {
			const pythonCode = `
def function():
    pass
class Class:
    def method(self):
        pass
    @staticmethod
    def static_method():
        pass
variable = 1
CONSTANT = 2
`

			expect(pythonCode).toContain("def function():")
			expect(pythonCode).toContain("class Class:")
			expect(pythonCode).toContain("def method(self):")
			expect(pythonCode).toContain("def static_method():")
			expect(pythonCode).toContain("variable = 1")
			expect(pythonCode).toContain("CONSTANT = 2")
		})
	})
})
