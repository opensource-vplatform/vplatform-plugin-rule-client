
    var ProgressBarUtil, jsonUtil, scopeManager, engine, ExpressionContext;

    exports.initModule = function(sBox) {
        ProgressBarUtil = sBox.getService("vjs.framework.extension.platform.services.view.widget.common.progressbar.ProgressBarUtil");
        jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
        scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
        engine = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
        ExpressionContext = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
    }

    var main = function(ruleContext) {
        var ruleCfgValue = ruleContext.getRuleCfg();
        // 获取规则链路由上下文,终止执行后续规则
        var routeContext = ruleContext.getRouteContext();
        var inParams = ruleCfgValue["inParams"];
        var inParamsObj = jsonUtil.json2obj(inParams);
        var display = inParamsObj["display"];
        var msgnote = inParamsObj["msgnote"];
        var isGlobal = (inParamsObj["displaytype"] + "").toLowerCase() === "current" ? false : true;
        var winScope = scopeManager.getWindowScope();
        if(!winScope){
        	winScope = scopeManager.getScope();
        }
        var currentScopeId = winScope ? winScope.getInstanceId() : null;
        if (display) {
            var msg = null,
                series = winScope && winScope.getSeries ? winScope.getSeries() : null;
            // 处理手机端加载提示信息
            if ("bootstrap_mobile" == series)
                msg = "正在加载...";
            if (msgnote != null && msgnote != "") {
                msg = experssFunc(msgnote, routeContext);
            }
            if(null == msg || "" == msg){
            	msg = "数据加载中，请稍后...";
            }
            //处理在构件方法中执行报未找到窗体容器实例的问题
            scopeManager.createScopeHandler({
            	scopeId:currentScopeId,
            	handler:function(){
            		ProgressBarUtil.showProgress(msg, isGlobal);
            	}
            })();
//            ProgressBarUtil.showProgress(msg, isGlobal);
//            var scopeId = scopeManager.getCurrentScopeId();
            var scope = scopeManager.getScope(currentScopeId);
            scope.on(scopeManager.EVENTS.DESTROY,(function(sId,isG){
            	return function(){
            		scopeManager.openScope(sId);
            		ProgressBarUtil.hideProgress(isG);
            		scopeManager.closeScope();
            	}
            })(currentScopeId,isGlobal));
            var routeContext = ruleContext.getRouteContext();
            routeContext.on({
                "eventName": routeContext.Events.EXCEPTION,
                "handler": function() {
                    ProgressBarUtil.hideProgress(isGlobal);
                }
            });
            routeContext.on({
                "eventName": routeContext.Events.INTERRUPT,
                "handler": function() {
                    ProgressBarUtil.hideProgress(isGlobal);
                }
            });
        } else {
        	//处理在构件方法中执行报未找到窗体容器实例的问题
        	scopeManager.createScopeHandler({
            	scopeId:currentScopeId,
            	handler:function(){
            		ProgressBarUtil.hideProgress(isGlobal);
            	}
            })();
        }

        var callbackFunc = function() {
            //ruleContext.fireRuleCallback();
            ruleContext.setRuleStatus(true);
            ruleContext.fireRuleCallback();
            ruleContext.fireRouteCallback();
        }

        //TODO 临时解决方案，待规则全部调整后去除
        //ruleContext.setRuleCallbackFireFlag(true);
        ruleContext.markRouteExecuteUnAuto();
        setTimeout(callbackFunc, 100);
        return true;
    };
    /*执行表达式*/
    var experssFunc = function(experss, routeContext) {
        var context = new ExpressionContext();
        context.setRouteContext(routeContext);
        if (undefined == experss || null == experss) return null;
        var resultValue = engine.execute({
            "expression": experss,
            "context": context
        });
        return resultValue;
    }
    exports.main = main;

export{    main}