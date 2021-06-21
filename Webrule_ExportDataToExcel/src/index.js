/**
 *
 *
 */

	var jsonUtil;
	var stringUtil;
	var whereRestrict;
	var scopeManager;
	var util;
	var ExpressionContext;
	var engine;

	exports.initModule = function(sBox) {
		jsonUtil = sBox
				.getService("vjs.framework.extension.util.JsonUtil");
		scopeManager = sBox
				.getService("vjs.framework.extension.platform.interface.scope.ScopeManager");
		util = sBox
				.getService("vjs.framework.extension.platform.services.where.restrict.QueryCondUtil");
		ExpressionContext = sBox
				.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionContext");
		engine = sBox
				.getService("vjs.framework.extension.platform.services.engine.expression.ExpressionEngine");
		stringUtil = sBox
				.getService("vjs.framework.extension.util.StringUtil");
		whereRestrict = sBox
				.getService("vjs.framework.extension.platform.services.where.restrict.WhereRestrict");

	}
	function MapTransform(cfg,ruleContext){
		var _result = {}
		var _deColumnMap = [];
		var _items = cfg["items"];
		if(_items){
			_result["defaultFileName"] =cfg["defaultFileName"]; 
			_result["fileType"] =cfg["fileType"];
			for(var i = 0;i<_items.length;i++){
				var _itc = _items[i];
				var _itp = {};
				_itp["title"] = cfg["defaultFileName"];
				var isAllNoExport = true;
				var context = new ExpressionContext();
				context.setRouteContext(ruleContext.getRouteContext());
				_itp["sheetName"] = engine.execute({"expression":_itc["sheetName"],"context":context});
				_itp["dataName"] = _itc["dataSource"];
				_itp["dataType"] = _itc["dataSourceType"];
				_itp["dsWhere"] = _itc["filterCondition"];
				_itp["dsQueryParam"] = _itc["queryParam"];
				var _fi = [];
				for(var j=0;j<_itc["mapping"].length;j++){
					var _itfc = _itc["mapping"][j];
					var _fic = {};
					_fic["chineseName"] = _itfc["excelColName"];
					_fic["fieldName"] = _itfc["fieldCode"];
					_fic["needExport"] = _itfc["exportData"];
					if(_fic["needExport"]&&_fic["needExport"]==true){
						isAllNoExport = false;
					}
					_fic["orderBy"] = _itfc["orderType"];
					_fic["orderNo"] = j;
					_fi[j] = _fic;
				}
				_itp["dsColumnMap"] = _fi;
				_itp["isAllNoExport"] = isAllNoExport;
				_deColumnMap[i] = _itp;
			}
			_result["items"] =_deColumnMap;
		}
		return _result;
	}
	var main = function(ruleContext) {
		var ruleConfig = ruleContext.getRuleCfg();

		var inParams = ruleConfig.inParams;
		var config = jsonUtil.json2obj(inParams);
		config = MapTransform(config,ruleContext);
		var gb_condSql = {};
		var gb_title = {};
		var gb_params = {};
		var gb_condParams = {};
		var routeContext = ruleContext.getRouteContext();
		var fileType= config["fileType"];
		for(var _i = 0;_i<config["items"].length;_i++){
			cfg = config["items"][_i];
			var dataName = cfg.dataName;
			var iden_con = dataName+"_"+cfg.sheetName;
			// 处理查询条件
			var condCfgs = cfg.dsWhere;
			var wrParam = {
					"fetchMode": 'custom',
					"routeContext": routeContext
				};
			var where = whereRestrict.init(wrParam);
			if (condCfgs != null && condCfgs.length > 0) {
				where.andExtraCondition(condCfgs, 'custom');
			}
			// 处理查询参数
			var params = {};
			if ('QUERY' == stringUtil.toUpperCase(cfg.dataType)) {
				var queryParams = cfg.dsQueryParam;
				if (queryParams != null && queryParams.length > 0) {
					// params =
					// queryConditionUtil.genCustomParams(queryParams);
					params = util.genCustomParams({
						"paramDefines" : queryParams,
						"routeContext" : ruleContext.getRouteContext()
					});
				}
			}
			var title = '';
			var context = new ExpressionContext();
			context.setRouteContext(ruleContext.getRouteContext());
			if (cfg.title)
				title = engine.execute({
					"expression" : cfg.title,
					"context" : context
				});
			gb_condSql[iden_con] = where.toWhere();
			gb_condParams[iden_con] = where.toParameters();
			gb_params[iden_con] = params;
			gb_title[iden_con] = title;
		}
		var option = {
			ruleInstId : ruleConfig.instanceCode,
			title : gb_title,
			condSql : gb_condSql,
			condParams : gb_condParams,
			params : gb_params,
			ruleConfig : jsonUtil.obj2json(config),
			ruleName:"ExportDataToExcel",
			fileType:fileType
		};
		var token = {
			data : option
		};
		var scope = scopeManager.getScope();
		var componentCode = scope.getComponentCode();

		var scope = scopeManager.getWindowScope();
		var windowCode = scope ? '&windowCode=' + scope.getWindowCode() : "";

		var url = 'module-operation!executeOperation?componentCode='
				+ componentCode + windowCode
				+ '&operation=ExportDataToExcel';

		/**
		 * 梁朝辉 2015-02-09 创建一个from用post的方法提交数据，防止url超长的问题
		 * token在createForm时处理
		 */
		// url += '&token=' +
		// encodeURIComponent(encodeURIComponent(jsonUtil.obj2json(token)));
		var iframeId = "file_down_iframe";
		var formId = "iframeDownForm"
		var tokenJson = jsonUtil.obj2json(token);
		var tokenEncode = encodeURIComponent(tokenJson);
		createIFrame(iframeId, "");
		var formObj = createForm(formId, iframeId, url, tokenEncode);
		formObj.submit();
		// createIFrame("file_down_iframe",url);
	}

	/**
	 * 梁朝辉 2015-02-09 创建一个from用post的方法提交数据，防止url超长的问题
	 */
	function createForm(formId, iframeId, actionUrl, tokenId) {
		var formObj = document.getElementById(formId);
		if (formObj == null) {
			formObj = document.createElement("form");
			formObj.setAttribute("id", formId);
			formObj.setAttribute("method", "post");
			formObj.setAttribute("target", iframeId);
			formObj.setAttribute("style", "display:none");
			document.body.appendChild(formObj);
		}
		formObj.setAttribute("action", actionUrl);
		formObj.innerHTML = "<input id='tokenId' type='hidden' name='token' value='"
				+ tokenId + "'>";
		return formObj;
	}

	function createIFrame(iframeId, url) {
		var iframeObj = document.getElementById(iframeId);
		if (iframeObj == null) {
			iframeObj = document.createElement("iframe");
			iframeObj.setAttribute("id", iframeId);
			iframeObj.setAttribute("style", "display:none");
			document.body.appendChild(iframeObj);
		}
		iframeObj.setAttribute("src", url);
	}
	exports.main = main;

export{    main}