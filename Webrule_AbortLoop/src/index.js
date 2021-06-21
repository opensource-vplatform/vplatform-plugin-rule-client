/**
 * 中断方法的执行
 */
var main = function (ruleContext) {
    return new Promise(function (resolve, reject) {
        // 获取方法上下文
        var methodContext = ruleContext.getMethodContext();
        // 获取规则配置
        var input = ruleContext.getVplatformInput();
        //执行类型 break/continue
        var type = input.abortType;
        if (type == "break") {
            methodContext.markLoopInterrupt(methodContext.LoopInterruptType.Break);
        } else if (type == "continue") {
            methodContext.markLoopInterrupt(methodContext.LoopInterruptType.Continue);
        } else {
            return reject(Error("中断循环类型值不正确：[" + type + "]"));
        }
        resolve();
    });
}

export {
    main
}