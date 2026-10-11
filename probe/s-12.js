      }
      parsePostMemberNameModifiers(methodOrProp) {
        const optional = this.eat(tt.question);
        if (optional) methodOrProp.optional = true;
        if (methodOrProp.readonly && this.match(tt.parenL)) {
          this.raise(methodOrProp.start, TypeScriptError.ClassMethodHasReadonly);
        }
        if (methodOrProp.declare && this.match(tt.parenL)) {
          this.raise(methodOrProp.start, TypeScriptError.ClassMethodHasDeclare);
        }
      }
      parseExpressionStatement(node, expr) {
        const decl = expr.type === "Identifier" ? this.tsParseExpressionStatement(node, expr) : void 0;
        return decl || super.parseExpressionStatement(node, expr);
      }
      shouldParseExportStatement() {
        if (this.tsIsDeclarationStart()) return true;
        if (this.match(tokTypes.at)) {
          return true;
        }
        return super.shouldParseExportStatement();
      }
