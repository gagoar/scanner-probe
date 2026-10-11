          this.raise(this.start, TypeScriptError.ExpectedAmbientAfterExportDeclare);
        }
        const isIdentifier = tokenIsIdentifier(this.type);
        const declaration = isIdentifier && this.tsTryParseExportDeclaration() || this.parseStatement(null);
        if (!declaration) return null;
        if (declaration.type === "TSInterfaceDeclaration" || declaration.type === "TSTypeAliasDeclaration" || isDeclare) {
          node.exportKind = "type";
        }
