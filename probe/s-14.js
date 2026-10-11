          if (result.error) {
            this.setOptionalParametersError(refDestructuringErrors, result.error);
          }
          return expr;
        }
        return result.node;
      }
      parseParenItem(node) {
        const startPos = this.start;
        const startLoc = this.startLoc;
        node = super.parseParenItem(node);
        if (this.eat(tt.question)) {
          node.optional = true;
          this.resetEndLocation(node);
        }
        if (this.match(tt.colon)) {
          const typeCastNode = this.startNodeAt(startPos, startLoc);
          typeCastNode.expression = node;
          typeCastNode.typeAnnotation = this.tsParseTypeAnnotation();
          return this.finishNode(typeCastNode, "TSTypeCastExpression");
        }
        return node;
