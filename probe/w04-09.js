        if (isDeclare && (this.ts_isContextual(tokTypes.declare) || !this.shouldParseExportStatement())) {
          this.raise(this.start, TypeScriptError.ExpectedAmbientAfterExportDeclare);
        }
        const isIdentifier = tokenIsIdentifier(this.type);
