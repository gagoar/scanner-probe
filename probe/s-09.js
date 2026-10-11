                if (this.canInsertSemicolon() || !this.eat(tt.arrow)) this.unexpected();
                return this.parseArrowExpression(this.startNodeAtNode(id), [paramId], true);
              } else {
                return id;
              }
            }
          }
          if (canBeArrow && this.match(tt.arrow) && !this.canInsertSemicolon()) {
            this.next();
            return this.parseArrowExpression(this.startNodeAtNode(id), [id], false);
          }
          return id;
        } else {
          this.unexpected();
        }
      }
      parseIdentNode() {
        let node = this.startNode();
        if (tokenIsKeywordOrIdentifier(this.type) &&
        !((this.type.keyword === "class" || this.type.keyword === "function") && (this.lastTokEnd !== this.lastTokStart + 1 || this.input.charCodeAt(this.lastTokStart) !== 46))) {
          node.name = this.value;
        } else {
