/**
 * 文件导出 <code>
{
    "dataName" : "my_product_query",
    "dataType" : "Query",
    "dsColumnMap" : [{
                "chineseName" : "产品",
                "fieldName" : "productName",
                "needExport" : true,
                "orderBy" : "asc",
                "orderNo" : "2"
            }],
    "fileType" : "Excel",
    "template" : "",
    "title" : "\"产品销售情况表\"",
    "dsWhere" : [{
                "columnType" : "1",
                "displayField" : "season(season)",
                "displayValue" : "第 2 季度",
                "field" : "season",
                "fieldType" : "1",
                "leftBracket" : null,
                "logicOperation" : null,
                "operation" : " = ",
                "rightBracket" : null,
                "value" : "第 2 季度",
                "valueType" : "5"
            }],
    "dsQueryParam" : [{
                "componentControlID" : "d38294b4c81f49eeb99f3cc56d51fded",
                "queryfield" : "type",
                "queryfieldValue" : "JGTextBox5",
                "type" : "6"
            }]
}
 * </code>
 */


			var jsonUtil;
			var stringUtil;
			var whereRestrict;
			var scopeManager;
			var util;
			var ExpressionContext;
			var engine;

			exports.initModule = function(sBox){
				 jsonUtil = sBox.getService("vjs.framework.extension.util.JsonUtil");
//				 viewContext = require('system/view/viewContext');
				 scopeManager = sBox.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
				 
//				 queryConditionUtil = require("system/util/queryConditionUtil");
				 util = sBox.getService("vjs.framework.extension.platform.services.where.restrict.QueryCondUtil");
				 
//				 formulaUtil = require("system/util/formulaUtil");
				 ExpressionContext = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
				 engine = sBox.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
				 
				 stringUtil = sBox.getService("vjs.framework.extension.util.StringUtil");
//				 WhereRestrict = require("system/util/WhereRestrict");
				 whereRestrict = sBox.getService("vjs.framework.extension.platform.services.where.restrict.WhereRestrict");

			}
			
			var main = function(ruleContext) {
				var ruleConfig = ruleContext.getRuleCfg();

				var inParams = ruleConfig.inParams;
				var cfg = jsonUtil.json2obj(inParams);

				// 处理查询条件
				var condCfgs = cfg.dsWhere;
//				var where = WhereRestrict.init();
				var where =whereRestrict.init();
				if (condCfgs != null && condCfgs.length > 0) {
					where.andExtraCondition(condCfgs, 'custom');
				}

				//处理查询参数
				var params = {};
				if ('QUERY' == stringUtil.toUpperCase(cfg.dataType)) {
					var queryParams = cfg.dsQueryParam;
					if (queryParams != null && queryParams.length > 0) {
//						params = queryConditionUtil.genCustomParams(queryParams);
						params = util.genCustomParams({"paramDefines":queryParams,"routeContext":ruleContext.getRouteContext()});
					}
				}

				//处理标题表达式
				var title = '';
//				if (cfg.title) title = formulaUtil.evalExpression(cfg.title);
				var context = new ExpressionContext();
				context.setRouteContext(ruleContext.getRouteContext());
				if (cfg.title) title = engine.execute({"expression":cfg.title,"context":context});
				
				var option = {
					ruleInstId : ruleConfig.instanceCode,
					title : title,
					condSql : where.toWhere(),
					condParams : where.toParameters(),
					params : params,
					ruleConfig : jsonUtil.obj2json(cfg)
				};

				var token = {
					data : option
				};
				var scope = scopeManager.getScope();
				var componentCode = scope.getComponentCode();
				
				var scope = scopeManager.getWindowScope();
				var windowCode = scope.getWindowCode();
				
				var url = 'module-operation!executeOperation?componentCode=' + componentCode 
						+ '&windowCode=' + windowCode
						+ '&operation=ExportData';
				
				/**
				 * 梁朝辉 2015-02-09
				 * 创建一个from用post的方法提交数据，防止url超长的问题
				 * token在createForm时处理
				 */
				// url += '&token=' + encodeURIComponent(encodeURIComponent(jsonUtil.obj2json(token)));
				var iframeId="file_down_iframe";
				var formId="iframeDownForm"
				var tokenJson=jsonUtil.obj2json(token);
				var tokenEncode= encodeURIComponent(tokenJson);	
				createIFrame(iframeId,"");
				var formObj=createForm(formId,iframeId,url,tokenEncode);
				formObj.submit();
				//createIFrame("file_down_iframe",url);
			}
	
	/**
	 * 梁朝辉 2015-02-09
	 * 创建一个from用post的方法提交数据，防止url超长的问题
	 */
	function createForm(formId,iframeId,actionUrl,tokenId){
		var formObj=document.getElementById(formId);
		if(formObj==null){
			formObj=document.createElement("form");
			formObj.setAttribute("id",formId);
			formObj.setAttribute("method","post");
			formObj.setAttribute("target",iframeId);
			formObj.setAttribute("style","display:none");
			document.body.appendChild(formObj);
		}
		formObj.setAttribute("action",actionUrl);
		formObj.innerHTML="<input id='tokenId' type='hidden' name='token' value='"+tokenId+"'>";
		return formObj;
	}
			
	function createIFrame(iframeId,url){
		var iframeObj=document.getElementById(iframeId);
		if(iframeObj==null){
			iframeObj=document.createElement("iframe");
			iframeObj.setAttribute("id",iframeId);
			iframeObj.setAttribute("style","display:none");
			document.body.appendChild(iframeObj);
		}
		iframeObj.setAttribute("src",url);
	}
			exports.main = main;

export{    main}