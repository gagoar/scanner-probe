        if (!this.isAmbientContext && this.ts_isContextual(tokTypes.declare)) {
          return this.tsInAmbientContext(() => this.parseExportDeclaration(node));
        }
