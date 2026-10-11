      }
      tsTryParseGenericAsyncArrowFunction(startPos, startLoc, forInit) {
        if (!this.tsMatchLeftRelational()) {
          return void 0;
        }
        const oldMaybeInArrowParameters = this.maybeInArrowParameters;
        this.maybeInArrowParameters = true;
        const res = this.tsTryParseAndCatch(() => {
          const node = this.startNodeAt(startPos, startLoc);
          node.typeParameters = this.tsParseTypeParameters(this.tsParseConstModifier);
          super.parseFunctionParams(node);
          node.returnType = this.tsTryParseTypeOrTypePredicateAnnotation();
          this.expect(tt.arrow);
          return node;
        });
        this.maybeInArrowParameters = oldMaybeInArrowParameters;
        if (!res) {
          return void 0;
        }
        return this.parseArrowExpression(
          res,
          res.params,
          true,
          forInit
        );
      }
      tsParseTypeArgumentsInExpression() {
        if (this.reScan_lt() !== tt.relational) {
          return void 0;
        }
        return this.tsParseTypeArguments(true);
      }
      tsInNoContext(cb) {
        const oldContext = this.context;
        this.context = [oldContext[0]];
        try {
          return cb();
        } finally {
          this.context = oldContext;
        }
      }
      tsTryParseTypeAnnotation() {
        return this.match(tt.colon) ? this.tsParseTypeAnnotation() : void 0;
      }
      isUnparsedContextual(nameStart, name) {
        const nameEnd = nameStart + name.length;
        if (this.input.slice(nameStart, nameEnd) === name) {
          const nextCh = this.input.charCodeAt(nameEnd);
          return !(isIdentifierChar(nextCh) ||
          (nextCh & 64512) === 55296);
        }
        return false;
      }
      isAbstractConstructorSignature() {
        return this.ts_isContextual(tokTypes.abstract) && this.lookahead().type === tt._new;
      }
      nextTokenStartSince(pos) {
        skipWhiteSpace.lastIndex = pos;
        return skipWhiteSpace.test(this.input) ? skipWhiteSpace.lastIndex : pos;
      }
      lookaheadCharCode() {
        return this.input.charCodeAt(this.nextTokenStart());
      }
      createLookaheadState() {
        this.value = null;
        this.context = [this.curContext()];
      }
      getCurLookaheadState() {
        return {
          endLoc: this.endLoc,
          lastTokEnd: this.lastTokEnd,
          lastTokStart: this.lastTokStart,
          lastTokStartLoc: this.lastTokStartLoc,
          pos: this.pos,
          value: this.value,
          type: this.type,
          exprAllowed: this.exprAllowed,
          start: this.start,
          end: this.end,
          context: this.context,
          startLoc: this.startLoc,
          lastTokEndLoc: this.lastTokEndLoc,
          curLine: this.curLine,
          lineStart: this.lineStart,
          containsEsc: this.containsEsc
        };
      }
      setLookaheadTokenState(state) {
        this.pos = state.pos;
        this.value = state.value;
        this.exprAllowed = state.exprAllowed;
        this.endLoc = state.endLoc;
        this.lastTokEnd = state.lastTokEnd;
        this.lastTokStart = state.lastTokStart;
        this.lastTokStartLoc = state.lastTokStartLoc;
        this.type = state.type;
        this.start = state.start;
        this.end = state.end;
        this.startLoc = state.startLoc;
        this.lastTokEndLoc = state.lastTokEndLoc;
        this.curLine = state.curLine;
        this.lineStart = state.lineStart;
        this.containsEsc = state.containsEsc;
      }
      setLookaheadState(state) {
        this.setLookaheadTokenState(state);
        this.context = state.context && state.context.slice();
      }
      beginParseEffectScope() {
        return this.parseEffects.begin();
      }
      selectTryParseResult(result) {
        const failedBranch = result.failState;
        if (!failedBranch) return;
        if (failedBranch.selected) {
          throw new Error("A parse branch result can only be selected once");
        }
        failedBranch.selected = true;
        this.parseEffects.replay(failedBranch.events);
      }
      tsLookAhead(f) {
        const frame = this.beginParseEffectScope();
        try {
          return f();
        } finally {
          this.parseEffects.rollback(frame);
        }
      }
      lookahead(number) {
        const oldState = this.getCurLookaheadState();
        const oldContext = this.context;
        const oldPreValue = this.preValue;
        const oldPreToken = this.preToken;
        const oldIsLookahead = this.isLookahead;
        try {
          this.createLookaheadState();
          this.isLookahead = true;
          if (number !== void 0) {
            for (let i = 0; i < number; i++) {
              this.nextToken();
            }
          } else {
            this.nextToken();
          }
          return this.getCurLookaheadState();
        } finally {
          this.setLookaheadTokenState(oldState);
          this.context = oldContext;
          this.preValue = oldPreValue;
          this.preToken = oldPreToken;
          this.isLookahead = oldIsLookahead;
        }
      }
      readWord() {
        let word = this.readWord1();
        let type = tt.name;
        if (this.keywords.test(word)) {
          type = keywordTypes[word];
        } else if (new RegExp(keywordsRegExp).test(word)) {
          type = tokTypes[word];
        }
        return this.finishToken(type, word);
      }
      skipBlockComment() {
        let startLoc;
        if (!this.isLookahead) startLoc = this.options.onComment && this.curPosition();
        let start = this.pos, end = this.input.indexOf("*/", this.pos += 2);
        if (end === -1) this.raise(this.pos - 2, "Unterminated comment");
        this.pos = end + 2;
        if (this.options.locations) {
          for (let nextBreak, pos = start; (nextBreak = nextLineBreak(this.input, pos, this.pos)) > -1; ) {
            ++this.curLine;
            pos = this.lineStart = nextBreak;
          }
        }
        if (this.isLookahead) return;
        if (this.options.onComment) {
          this.options.onComment(
            true,
            this.input.slice(start + 2, end),
            start,
            this.pos,
            startLoc,
            this.curPosition()
          );
        }
      }
      skipLineComment(startSkip) {
        let start = this.pos;
        let startLoc;
        if (!this.isLookahead) startLoc = this.options.onComment && this.curPosition();
        let ch = this.input.charCodeAt(this.pos += startSkip);
        while (this.pos < this.input.length && !isNewLine(ch)) {
          ch = this.input.charCodeAt(++this.pos);
        }
        if (this.isLookahead) return;
        if (this.options.onComment) {
          this.options.onComment(
            false,
            this.input.slice(start + startSkip, this.pos),
            start,
            this.pos,
            startLoc,
            this.curPosition()
          );
        }
      }
      finishToken(type, val) {
        this.preValue = this.value;
        this.preToken = this.type;
        this.end = this.pos;
        if (this.options.locations) this.endLoc = this.curPosition();
        let prevType = this.type;
        this.type = type;
        this.value = val;
        if (!this.isLookahead) {
          this.updateContext(prevType);
        }
      }
      resetStartLocation(node, start, startLoc) {
        node.start = start;
        node.loc.start = startLoc;
        if (this.options.ranges) node.range[0] = start;
      }
      isLineTerminator() {
        return this.eat(tt.semi) || super.canInsertSemicolon();
      }
      hasFollowingLineBreak() {
        skipWhiteSpaceToLineBreak.lastIndex = this.end;
        return skipWhiteSpaceToLineBreak.test(this.input);
      }
      addExtra(node, key, value, enumerable = true) {
        if (!node) return;
        const extra = node.extra = node.extra || {};
        if (enumerable) {
          extra[key] = value;
        } else {
          Object.defineProperty(extra, key, { enumerable, value });
        }
      }
      isLiteralPropertyName() {
        return tokenIsLiteralPropertyName(this.type);
      }
      hasPrecedingLineBreak() {
        return lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
      }
      createIdentifier(node, name) {
        node.name = name;
        return this.finishNode(node, "Identifier");
      }
      resetStartLocationFromNode(node, locationNode) {
        this.resetStartLocation(node, locationNode.start, locationNode.loc.start);
      }
      isThisParam(param) {
        return param.type === "Identifier" && param.name === "this";
      }
      isLookaheadContextual(name) {
        const next = this.nextTokenStart();
        return this.isUnparsedContextual(next, name);
      }
      ts_type_isContextual(type, token) {
        return type === token && !this.containsEsc;
      }
      ts_isContextual(token) {
        return this.type === token && !this.containsEsc;
      }
      ts_isContextualWithState(state, token) {
        return state.type === token && !state.containsEsc;
      }
      isContextualWithState(keyword, state) {
        return state.type === tt.name && state.value === keyword && !state.containsEsc;
      }
      tsIsStartOfMappedType() {
        this.next();
        if (this.eat(tt.plusMin)) {
          return this.ts_isContextual(tokTypes.readonly);
        }
        if (this.ts_isContextual(tokTypes.readonly)) {
          this.next();
        }
        if (!this.match(tt.bracketL)) {
          return false;
        }
        this.next();
        if (!this.tsIsIdentifier()) {
          return false;
        }
        this.next();
        return this.match(tt._in);
      }
      tsInDisallowConditionalTypesContext(cb) {
        const oldInDisallowConditionalTypesContext = this.inDisallowConditionalTypesContext;
        this.inDisallowConditionalTypesContext = true;
        try {
          return cb();
        } finally {
          this.inDisallowConditionalTypesContext = oldInDisallowConditionalTypesContext;
        }
      }
      tsTryParseType() {
        return this.tsEatThenParseType(tt.colon);
      }
      match(type) {
        return this.type === type;
      }
      matchJsx(type) {
        return this.type === acornTypeScript.tokTypes[type];
      }
      ts_eatWithState(type, nextCount, state) {
        const targetType = state.type;
        if (type === targetType) {
          for (let i = 0; i < nextCount; i++) {
            this.next();
          }
          return true;
        } else {
          return false;
        }
      }
      ts_eatContextualWithState(name, nextCount, state) {
        if (keywordsRegExp.test(name)) {
          if (this.ts_isContextualWithState(state, tokTypes[name])) {
            for (let i = 0; i < nextCount; i++) {
              this.next();
            }
            return true;
          }
          return false;
        } else {
          if (!this.isContextualWithState(name, state)) return false;
          for (let i = 0; i < nextCount; i++) {
            this.next();
          }
          return true;
        }
      }
      canHaveLeadingDecorator() {
        return this.match(tt._class) || this.isAbstractClass() || this.isDeclareClass();
      }
      eatContextual(name) {
        if (keywordsRegExp.test(name)) {
          if (this.ts_isContextual(tokTypes[name])) {
