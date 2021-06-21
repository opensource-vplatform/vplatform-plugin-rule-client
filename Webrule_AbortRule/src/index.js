/**
 * 中断方法的执行
 */
var main = function(ruleContext) {
    return new Promise(function(resolve,reject){
         // 获取方法上下文
        var methodContext = ruleContext.getMethodContext();
        // 获取规则配置
        var input = ruleContext.getVplatformInput();
        if (input) {
            var abortType = input.abortType;
            if (abortType.toUpperCase() == "CURRENT"){
                //中断当前方法
                methodContext.markInterrupt(methodContext.InterruptType.Current);
            }else if (abortType.toUpperCase() == "GLOBAL"){
                //中断所有方法
                methodContext.markInterrupt(methodContext.InterruptType.Global);
            }else{
                return reject(new Error("不支持中断方式：" + abortType));
            }
        }else {
            // 未配置规则，则中断当前方法
            methodContext.markInterrupt(methodContext.InterruptType.Current);
        }
        resolve();
    });
}

export {
    main
}
