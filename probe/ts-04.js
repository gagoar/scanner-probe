      length: target.length
    });
  }
  willMutateTail(target, count) {
    if (!this.active) return;
    const start = Math.max(0, target.length - count);
    this.undoLog.push({
      _tag: "ArrayTail",
      target,
      start,
      values: target.slice(start)
    });
  }
  willSet(target, key) {
    if (!this.active) return;
    const record = target;
    this.undoLog.push({
      _tag: "Property",
      target: record,
      key,
      had: Object.prototype.hasOwnProperty.call(record, key),
      value: record[key]
    });
  }
  captureCallbacks() {
    let captured = false;
    for (const name of parserCallbackNames) {
      const callback = this.options[name];
      if (!callback) continue;
      captured = true;
      this.callbacks[name] = callback;
      this.callbackWrappers[name] = (...args) => {
        this.emit({
          name,
          args
        });
      };
    }
    return captured;
  }
  activateCallbacks() {
    for (const name of parserCallbackNames) {
      const callback = this.callbackWrappers[name];
      if (callback) {
        this.options[name] = callback;
      }
    }
  }
  deactivateCallbacks() {
    for (const name of parserCallbackNames) {
      const callback = this.callbacks[name];
      if (callback) {
        this.options[name] = callback;
      }
    }
  }
  emit(event) {
    const frame = this.currentFrame();
    if (!frame) {
      this.invoke(event);
      return;
    }
    const segments = this.outputFor(frame).segments;
    const tail = segments[segments.length - 1];
    if (Array.isArray(tail)) {
      tail.push(event);
    } else {
      segments.push([event]);
    }
  }
  appendOutput(target, output) {
    if (hasEvents(output)) {
      target.segments.push(output);
    }
  }
  outputFor(frame) {
    return frame.output ??= makeOutputBuffer();
  }
  flush(output) {
    const work = [];
    for (let i = output.segments.length - 1; i >= 0; i--) {
      work.push(output.segments[i]);
    }
    while (work.length > 0) {
      const segment = work.pop();
      if (Array.isArray(segment)) {
        for (const event of segment) {
          this.invoke(event);
        }
        continue;
      }
      for (let i = segment.segments.length - 1; i >= 0; i--) {
        work.push(segment.segments[i]);
      }
    }
  }
  invoke(event) {
    const callback = this.callbacks[event.name];
    callback?.apply(this.options, event.args);
  }
  currentFrame() {
    return this.frames[this.frames.length - 1];
  }
  close(frame) {
    if (this.currentFrame() !== frame || frame.depth !== this.frames.length - 1) {
      throw new Error("Parse effect scopes must be closed in order");
    }
    this.frames.pop();
    if (this.frames.length === 0 && this.hasCallbacks) {
      this.deactivateCallbacks();
    }
  }
  restore(frame) {
    if (this.state) {
      this.state.restore(frame.checkpoint);
    }
  }
  unwind(mark) {
    for (let i = this.undoLog.length - 1; i >= mark; i--) {
      const entry = this.undoLog[i];
      switch (entry._tag) {
        case "ArrayLength":
          if (entry.target.length < entry.length) {
            throw new Error("A parse effect shortened an append-only array");
          }
          entry.target.length = entry.length;
          break;
        case "ArrayTail":
          entry.target.length = entry.start;
          for (const value of entry.values) {
            entry.target.push(value);
          }
          break;
        case "Property":
          if (entry.had) {
            entry.target[entry.key] = entry.value;
          } else {
            delete entry.target[entry.key];
          }
          break;
      }
    }
    this.undoLog.length = mark;
  }
};
function restoreArrayMark(value, length, description) {
  if (value.length === length) {
    return value;
  }
  if (value.length < length) {
    throw new Error(`A parse branch shortened the ${description} below its checkpoint`);
  }
  value.length = length;
  return value;
}
function captureParserCheckpoint(parser) {
  return {
    lookahead: parser.getCurLookaheadState(),
    context: parser.context,
    contextLength: parser.context.length,
    scopeStack: parser.scopeStack,
    scopeStackLength: parser.scopeStack.length,
    importsStack: parser.importsStack,
    importsStackLength: parser.importsStack.length,
    labels: parser.labels,
    labelsLength: parser.labels.length,
    privateNameStack: parser.privateNameStack,
    privateNameStackLength: parser.privateNameStack.length,
    decoratorStack: parser.decoratorStack,
    decoratorStackLength: parser.decoratorStack.length,
    strict: parser.strict,
    potentialArrowAt: parser.potentialArrowAt,
    potentialArrowInForAwait: parser.potentialArrowInForAwait,
    yieldPos: parser.yieldPos,
    awaitPos: parser.awaitPos,
    awaitIdentPos: parser.awaitIdentPos,
    preValue: parser.preValue,
    preToken: parser.preToken,
    isLookahead: parser.isLookahead,
    isAmbientContext: parser.isAmbientContext,
    inAbstractClass: parser.inAbstractClass,
    inType: parser.inType,
    inDisallowConditionalTypesContext: parser.inDisallowConditionalTypesContext,
    maybeInArrowParameters: parser.maybeInArrowParameters,
    shouldParseArrowReturnType: parser.shouldParseArrowReturnType,
    shouldParseAsyncArrowReturnType: parser.shouldParseAsyncArrowReturnType,
    importOrExportOuterKind: parser.importOrExportOuterKind
  };
}
function restoreParserCheckpoint(parser, state) {
  parser.setLookaheadTokenState(state.lookahead);
  parser.context = restoreArrayMark(state.context, state.contextLength, "token context stack");
  parser.scopeStack = restoreArrayMark(state.scopeStack, state.scopeStackLength, "scope stack");
  parser.importsStack = restoreArrayMark(
    state.importsStack,
    state.importsStackLength,
    "import stack"
  );
  parser.labels = restoreArrayMark(state.labels, state.labelsLength, "label stack");
  parser.privateNameStack = restoreArrayMark(
    state.privateNameStack,
    state.privateNameStackLength,
    "private-name stack"
  );
  parser.decoratorStack = restoreArrayMark(
    state.decoratorStack,
    state.decoratorStackLength,
    "decorator stack"
  );
  parser.strict = state.strict;
  parser.potentialArrowAt = state.potentialArrowAt;
  parser.potentialArrowInForAwait = state.potentialArrowInForAwait;
  parser.yieldPos = state.yieldPos;
  parser.awaitPos = state.awaitPos;
  parser.awaitIdentPos = state.awaitIdentPos;
  parser.regexpState = null;
  parser.preValue = state.preValue;
  parser.preToken = state.preToken;
  parser.isLookahead = state.isLookahead;
  parser.isAmbientContext = state.isAmbientContext;
  parser.inAbstractClass = state.inAbstractClass;
  parser.inType = state.inType;
  parser.inDisallowConditionalTypesContext = state.inDisallowConditionalTypesContext;
  parser.maybeInArrowParameters = state.maybeInArrowParameters;
  parser.shouldParseArrowReturnType = state.shouldParseArrowReturnType;
  parser.shouldParseAsyncArrowReturnType = state.shouldParseAsyncArrowReturnType;
  parser.importOrExportOuterKind = state.importOrExportOuterKind;
}
function createParserStateAdapter(parser) {
  return {
    capture: () => captureParserCheckpoint(parser),
    restore: (state) => restoreParserCheckpoint(parser, state)
  };
}
function adaptParser(Parser, config) {
  const tt = config.acornTokenTypes;
  const tsTokTypes = config.typeScriptTokenTypes;
  const scopeFlags = config.scope;
  const varScopeFlags = scopeFlags.SCOPE_TOP | scopeFlags.SCOPE_FUNCTION | scopeFlags.SCOPE_CLASS_STATIC_BLOCK;
  return class EffectAdapter extends Parser {
    constructor(options, input, startPos) {
      super(options, input, startPos);
      this.parseEffects = new ParseEffects(this.options, createParserStateAdapter(this));
    }
    overrideContext(context) {
      if (this.curContext() !== context) {
        this.parseEffects?.willMutateTail(this.context, 1);
      }
      return super.overrideContext(context);
    }
    takeDecorators(node) {
      const index = this.decoratorStack.length - 1;
      if (this.decoratorStack[index].length > 0) {
        this.parseEffects?.willSet(this.decoratorStack, String(index));
      }
      return super.takeDecorators(node);
    }
    parseDecorators(allowExport) {
      const decorators = this.decoratorStack[this.decoratorStack.length - 1];
      this.parseEffects?.willAppend(decorators);
      return super.parseDecorators(allowExport);
    }
    parseDecorator() {
      this.parseEffects?.willAppend(this.decoratorStack);
      return super.parseDecorator();
    }
    parseIdentNode() {
      const consumesKeywordContext = (this.type.keyword === "class" || this.type.keyword === "function") && (this.lastTokEnd !== this.lastTokStart + 1 || this.input.charCodeAt(this.lastTokStart) !== 46);
      if (consumesKeywordContext) {
        this.parseEffects?.willMutateTail(this.context, 1);
      }
      return super.parseIdentNode();
    }
    parseLabeledStatement(node, maybeName, expr, context) {
      for (let i = this.labels.length - 1; i >= 0; i--) {
        const label = this.labels[i];
        if (label.statementStart !== node.start) break;
        this.parseEffects?.willSet(label, "statementStart");
        this.parseEffects?.willSet(label, "kind");
      }
      this.parseEffects?.willAppend(this.labels);
      return super.parseLabeledStatement(node, maybeName, expr, context);
    }
    enterClassBody() {
      this.parseEffects?.willAppend(this.privateNameStack);
      return super.enterClassBody();
    }
    exitClassBody() {
      const parent = this.privateNameStack[this.privateNameStack.length - 2];
      if (parent) {
        this.parseEffects?.willAppend(parent.used);
      }
      this.parseEffects?.willMutateTail(this.privateNameStack, 1);
      return super.exitClassBody();
    }
    parsePrivateIdent() {
      if (this.options.checkPrivateFields && this.privateNameStack.length > 0) {
        const privateNames = this.privateNameStack[this.privateNameStack.length - 1];
        this.parseEffects?.willAppend(privateNames.used);
      }
      return super.parsePrivateIdent();
    }
    parseClassField(field) {
      this.parseEffects?.willSet(this.currentThisScope(), "inClassFieldInit");
      return super.parseClassField(field);
    }
    updateContext(prevType) {
      const { type } = this;
      const mutatesContext = type === tt.parenR || type === tt.braceR || type === tt.braceL || type === tt.dollarBraceL || type === tt.parenL || type === tt._function || type === tt._class || type === tt.colon || type === tt.backQuote || type === tt.star || type === tsTokTypes.jsxTagStart || type === tsTokTypes.jsxTagEnd || type === tt.slash && prevType === tsTokTypes.jsxTagStart;
      if (mutatesContext) {
        this.parseEffects?.willMutateTail(this.context, 2);
      }
      return super.updateContext(prevType);
    }
    enterScope(flags) {
      this.parseEffects?.willAppend(this.scopeStack);
      return super.enterScope(flags);
    }
    exitScope() {
      this.parseEffects?.willMutateTail(this.scopeStack, 1);
      return super.exitScope();
    }
    declareName(name, bindingType, pos) {
      const effects = this.parseEffects;
      if (effects?.active) {
        if (bindingType === scopeFlags.BIND_LEXICAL) {
          const scope = this.currentScope();
          effects.willAppend(scope.lexical);
          if (this.inModule && scope.flags & scopeFlags.SCOPE_TOP) {
            effects.willSet(this.undefinedExports, name);
          }
        } else if (bindingType === scopeFlags.BIND_SIMPLE_CATCH) {
          effects.willAppend(this.currentScope().lexical);
        } else if (bindingType === scopeFlags.BIND_FUNCTION) {
          effects.willAppend(this.currentScope().functions);
        } else {
          for (let i = this.scopeStack.length - 1; i >= 0; i--) {
            const scope = this.scopeStack[i];
            effects.willAppend(scope.var);
            if (this.inModule && scope.flags & scopeFlags.SCOPE_TOP) {
              effects.willSet(this.undefinedExports, name);
            }
