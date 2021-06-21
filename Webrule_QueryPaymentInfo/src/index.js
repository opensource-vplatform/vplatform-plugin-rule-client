/**
 *
 *
 */

    var jsonUtil;

    var payService;
    var engine ;
    var context ;
    var ExpressionContext;
    var manager , DBFactory , scopeManager ,dbService ;
    //初始化vjs模块，如果规则逻辑需要引用相关vjs服务，则初始化相关vjs模块；如果不需要初始化逻辑可以为空
    exports.initModule = function(sBox){
        //sBox：前台vjs的沙箱（容器/上下文），可以用它根据vjs名称，获取到相应vjs服务
        jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
        payService = sBox.getService("vjs.framework.extension.platform.services.native.mobile.Pay");
        engine = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
        ExpressionContext = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
        
        manager = sBox.getService("vjs.framework.extension.platform.services.model.manager.datasource.DatasourceManager");
        DBFactory = sBox.getService("vjs.framework.extension.platform.interface.model.datasource.DatasourceFactory");
        scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
        dbService = sBox.getService("vjs.framework.extension.platform.services.view.logic.datasource.DatasourceUtil");
    }

    //规则主入口(必须有)
    var main = function (ruleContext) {
        // 获取规则链路由上下文,终止执行后续规则
        var routeContext = ruleContext.getRouteContext();
        context = new ExpressionContext();
        context.setRouteContext(routeContext);
        // 获取规则链路由上下文的配置参数值
        var ruleCfgValue = ruleContext.getRuleCfg();
        // 获取开发系统配置的参数
        var inParams = ruleCfgValue["inParams"];
        var cfg = jsonUtil.json2obj(inParams);

        cfg.liveMode = cfg.liveMode == "true" ? "true" : "false"; //true  真实支付场景  否则为模拟支付场景

        var chargeId =  engine.execute({"expression":cfg.chargeId ,"context":context}); ;

        var success =  scopeManager.createScopeHandler({
            handler : function(result){
                result.isSuccess = true;
                result.errorMsg = "";
                if(result.created)
                    result.created = unixTimestampToDate(result.created);
                if(result.time_paid)
                    result.time_paid = unixTimestampToDate(result.time_paid);
                if(result.time_expire)
                    result.time_expire = unixTimestampToDate(result.time_expire);

                setBusinessRuleResult(ruleContext , cfg.returnValues , result  );
                ruleContext.fireRouteCallback();
            }
        });


        var fail = function(errorMsg){
            setBusinessRuleResult(ruleContext , cfg.returnValues , {
                isSuccess : false,
                errorMsg: errorMsg //错误信息
            }  );
            ruleContext.fireRouteCallback();
        };

        ruleContext.markRouteExecuteUnAuto();
        payService.getPayInfo({
                chargeId: chargeId,
                liveMode : cfg.liveMode
            }
            , success, fail);
    };

    function setBusinessRuleResult(ruleContext , returnValues , result ) {
        for( var i = 0 ; i < returnValues.length ; i++ ){
            var targetType = returnValues[i].targetType ;
            var target = returnValues[i].target ;
            var source = returnValues[i].source ;
            if(returnValues[i].destFieldMapping){
            	var destFieldMapping = returnValues[i].destFieldMapping ;  
            	var records = new Array() ;
            	for( var sourceKey in result[source] ){
            		var record = new Map();
            		record.set("key" , sourceKey) ;
            		record.set("value" ,result[source][sourceKey] );
            		records.push(record);
            	}
            	dbService.insertOrUpdateRecords2Entity(  target, targetType, records, destFieldMapping , returnValues[i].updateDestEntityMethod , returnValues[i].isCleanDestEntityData, ruleContext);
            }else{
            	if(targetType == "ruleSetVar" ){
                    ruleContext.getRouteContext().setVariable(target, result[source]);
                }else if(targetType == "ruleSetOutput" ){
                	dbService.insertOrUpdateRecords2Entity(  target, targetType, records, destFieldMapping , returnValues[i].updateDestEntityMethod , returnValues[i].isCleanDestEntityData, ruleContext);
                }else if(targetType == "ruleSetInput" ){
                	dbService.insertOrUpdateRecords2Entity(  target, targetType, records, destFieldMapping , returnValues[i].updateDestEntityMethod , returnValues[i].isCleanDestEntityData, ruleContext);
                } else{
                    log.warn("无效的返回类型："+ resultType );
                }
            }
        }
    }

    function unixTimestampToDate(unixTimestamp){
        if(typeof(unixTimestamp) == "string"){
            unixTimestamp = parseInt(unixTimestamp) ;
        }
        if(typeof(unixTimestamp) != "number"){
            throw new Error("unix时间戳格式错误。");
        }

        var date = new Date(unixTimestamp * 1000) ;
        return formateDate("yyyy-MM-dd hh:mm:ss" , date);
    }
    function formateDate(format , date){
        var dateDetail = {
            "M+": date.getMonth() + 1,
            "d+": date.getDate(),
            "h+": date.getHours(),
            "m+": date.getMinutes(),
            "s+": date.getSeconds(),
            "q+": Math.floor((date.getMonth() + 3) / 3),
            "S+": date.getMilliseconds()
        };
        if (/(y+)/i.test(format)) {
            format = format.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length));
        }
        for (var k in dateDetail) {
            if (new RegExp("(" + k + ")").test(format)) {
                format = format.replace(RegExp.$1, RegExp.$1.length == 1 ? dateDetail[k] : ("00" + dateDetail[k]).substr(("" + dateDetail[k]).length));
            }
        }
        return format;
    }

    //注册规则主入口方法(必须有)
    exports.main = main;

export{    main}