          return this.tsInAmbientContext(() => this.parseExportDeclaration(node));
        }
        const startPos = this.start;
        const startLoc = this.startLoc;
