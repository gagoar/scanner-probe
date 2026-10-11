          return super.parseIdentNode();
        }
        return node;
      }
      parseVarStatement(node, kind, allowMissingInitializer = false) {
        const { isAmbientContext } = this;
        this.next();
        super.parseVar(node, false, kind, allowMissingInitializer || isAmbientContext);
        this.semicolon();
        const declaration = this.finishNode(node, "VariableDeclaration");
        if (!isAmbientContext) return declaration;
        for (const { id, init } of declaration.declarations) {
          if (!init) continue;
          if (kind !== "const" || !!id.typeAnnotation) {
            this.raise(init.start, TypeScriptError.InitializerNotAllowedInAmbientContext);
          } else if (init.type !== "Literal" && (init.type !== "TemplateLiteral" || init.expressions.length > 0) && !isAmbientNumericUnaryExpression(init) && !isPossiblyLiteralEnum(init)) {
            this.raise(
              init.start,
              TypeScriptError.ConstInitiailizerMustBeStringOrNumericLiteralOrLiteralEnumReference
            );
          }
        }
