/**
 *
 *
 */
 vds.import("vds.expression.*","vds.app.*","vds.ds.*","vds.window.*","vds.exception.*")
/**
 * 规则入口
 */
var main = function (ruleContext) {
    return new Promise(function (resolve, reject) {
        try {
            var cfg = ruleContext.getVplatformInput();
            if (!cfg) {//建议兼容
                cfg = "";
            }
            cfg.liveMode = cfg.liveMode == "true" ? "true" : "false"; //true  真实支付场景  否则为模拟支付场景
            var chargeId = cfg.chargeId;
            if (chargeId) {
                chargeId = vds.expression.execute(chargeId, {
                    "ruleContext": ruleContext
                });
            }
            var success = ruleContext.genAsynCallback(function (result) {
                try {
                    result.isSuccess = true;
                    result.errorMsg = "";
                    if (result.created)
                        result.created = unixTimestampToDate(result.created);
                    if (result.time_paid)
                        result.time_paid = unixTimestampToDate(result.time_paid);
                    if (result.time_expire)
                        result.time_expire = unixTimestampToDate(result.time_expire);
                    setBusinessRuleResult(ruleContext, cfg.returnValues, result);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
            var fail = function (errorMsg) {
                try {
                    setBusinessRuleResult(ruleContext, cfg.returnValues, {
                        isSuccess: false,
                        errorMsg: errorMsg //错误信息
                    });
                    resolve();
                } catch (err) {
                    reject(err);
                }
            };
            var promise = vds.app.getPayInfo(chargeId, cfg.liveMode);
            promise.then(success).catch(fail);
        } catch (err) {
            reject(err);
        }
    });
}

function setBusinessRuleResult(ruleContext, returnValues, result) {
    for (var i = 0; i < returnValues.length; i++) {
        var targetType = returnValues[i].targetType;
        var target = returnValues[i].target;
        var source = returnValues[i].source;
        if (returnValues[i].destFieldMapping) {
            var destFieldMapping = returnValues[i].destFieldMapping;
            var newMappings = [];
            for (var j = 0, len = destFieldMapping.length; j < len; j++) {
                newMappings.push({
                    "code": destFieldMapping[j]["destField"],
                    "type": destFieldMapping[j]["srcValueType"],
                    "value": destFieldMapping[j]["srcValue"]
                })
            }
            var isClear = false;
            var mergeType;
            switch (returnValues[i].updateDestEntityMethod) {
                case "loadRecord":
                    mergeType = vds.ds.MergeType.Load;
                    isClear = true;
                    break;
                case "loadRecord":
                    mergeType = vds.ds.MergeType.Update;
                    break;
                default:
                    mergeType = vds.ds.MergeType.InsertOrUpdate;
                    isClear = returnValues[i].isCleanDestEntityData;
                    break;
            }
            var records = new Array();
            for (var sourceKey in result[source]) {
                var record = new Map();
                record.set("key", sourceKey);
                record.set("value", result[source][sourceKey]);
                records.push(record);
            }
            var destEntity = getEntity(target, targetType, ruleContext);
            vds.ds.merge(destEntity, records, newMappings, mergeType, isClear, ruleContext.getMethodContext(), {
                "isClear": isClear
            });
        } else {
            if (targetType == "ruleSetVar") {
                ruleContext.getMethodContext().setVariable(target, result[source]);
            }
        }
    }
}
var getEntity = function (entityName, entityType, ruleContext) {
    var entity;
    if (entityType == "entity" || entityType == "window") {
        entity = vds.ds.lookup(entityName);
    } else if (entityType == "windowVariant" || entityType == "windowInput") {
        entity = vds.window.getInput(entityName);
    } else if (entityType == "windowOutput") {
        entity = vds.window.getOutput(entityName);
    } else if (entityType == "ruleSetInput") {
        entity = ruleContext.getMethodContext().getInput(entityName);
    } else if (entityType == "ruleSetOutput") {
        entity = ruleContext.getMethodContext().getOutput(entityName);
    } else if (entityType == "ruleSetVariant" || entityType == "ruleSetVar") {
        entity = ruleContext.getMethodContext().getVariable(entityName);
    }
    if (undefined == entity || null == entity)
        throw vds.exception.newConfigException("找不到类型为[" + entityType + "]的实体：" + entityName);
    return entity;
}

function unixTimestampToDate(unixTimestamp) {
    if (typeof (unixTimestamp) == "string") {
        unixTimestamp = parseInt(unixTimestamp);
    }
    if (typeof (unixTimestamp) != "number") {
        throw vds.exception.newSystemException("unix时间戳格式错误。");
    }

    var date = new Date(unixTimestamp * 1000);
    return formateDate("yyyy-MM-dd hh:mm:ss", date);
}
function formateDate(format, date) {
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

export {
    main
}