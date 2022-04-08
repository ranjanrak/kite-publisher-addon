(function() {
	if(window.hasOwnProperty("KiteConnect")) {
		return false;
	}

	// Static variables.
	var $ = null,
		_root = typeof(_KITE_ROOT) != "undefined" ? _KITE_ROOT : "https://kite.zerodha.com",
		_uri_basket = "/connect/basket",
		_uri_login = "/connect/login",
		_uri_holdings_auth = "/connect/portfolio/authorise/holdings",
		_uri_css = "/static/build/css/publisher.min.css",
		_fields = ["variety", "exchange", "tradingsymbol", "transaction_type", "quantity", "order_type", "price", "trigger_price", "product", "validity", "readonly", "tag", "stoploss", "squareoff", "trailing_stoploss", "disclosed_quantity"],
		_max_items = 50,
		_options = {"redirect_url": 1, "api_key": 1},
		_hosts = ["kite.zerodha.net", "kite.zerodha.com", "localhost", "127.0.0.1"],
		_is_mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|Trident|IEMobile|Edge|Opera Mini/i.test(navigator.userAgent),

		modal_box = null,
		active_instance = null,
		loaded = false;
        win_event = false;

	// Open an inline dialog.
	function modal(url, title) {
		// A dialog is already open, clear it.
		this.clear = function() {
			$("#kite-modal-wrap").fadeOut(200, function() {
				$(this).remove();
				modal_box = null;
				active_instance = null;
			});
		}

		var maxw = $(window).width(),
			maxh = $(window).height();

		// Compute the width for the dialog.
		var w = screen.width/2 < 500 ? 500 : screen.width/2,
			h = screen.height/1.5 < 500 ? 500 : screen.height/1.5;

		var mod = $("<div id='kite-modal'>"),
			frame = $("<iframe id='kite-frame'>"),
			close = $("<a href='#' title='Close'>").html("&times;").attr("id", "kite-close");

		// Close dialog.
		close.click(function() {
			if(confirm("Do you want to abandon this transaction and go back?")) {
				if(active_instance) {
					active_instance.callback("cancelled", null);
				}
				modal_box && modal_box.clear();
			}
			return false;
		});

		$("body").append($("<div id='kite-modal-wrap'>").append(mod));
		mod.append(close).append(frame);

		var fr = frame.contents()[0];
		fr.open();
		fr.write("<!doctype html><html><head></head><body></body></html>");
		fr.close();

		// mod.css("opacity", 0).animate({
		// 	opacity: 1,
		// }, 600, "ease-in");

		modal_box = this;

		return frame.contents().find("body");
	}

	function popup(url, title, w, h) {
		var me = this;

		this.clear = function() {
			me.win.close();
		}

		if(modal_box) {
			modal_box.clear();
		}

		var maxw = $(window).width(),
			maxh = $(window).height();

		// Compute the width for the dialog.
		if(!w) {
			w = screen.width/2 < 500 ? 500 : screen.width/2;
		}
		if(!h) {
			h = screen.height/1.5 < 500 ? 500 : screen.height/1.8;
		}

		var	left = (screen.width / 2) - (w/2),
			top = (screen.height / 2) - (h/2);

		var params = "width=%,height=%,left=%,top=%,status=no,menubar=no,toolbar=no,scrollbars=yes"
						.replace("%", w)
						.replace("%", h)
						.replace("%", left)
						.replace("%", top);

		this.win = window.open(url, title, params);
		modal_box = this;

        // Capture pop-up window close event
        if(active_instance) {
            active_instance.winEvent(this.win);
        }

		return $(this.win.document).find("body");
	}

	// Create and return an input element.
	function inputField(name, value) {
		var input = $("<input>")
					.attr("name", name)
					.attr("type", "hidden")
					.attr("value", value);

		return input;
	}

	// Create and return the payload form.
	function createForm(fields, url, method) {
		var form = $("<form>");
		form.attr("method", method).attr("action", url);

		// Options.
		for(f in fields) {
			if(fields.hasOwnProperty(f)) {
				form.append(inputField(f, fields[f]));
			}
		}

		return form;
	}

	// Get the payload fields object.
	function fields(basket, options) {
		var fields = {"data": JSON.stringify(basket)};
		for(var o in options) {
			if(options.hasOwnProperty(o)) {
				fields[o] = options[o];
			}
		}

		return fields;
	}

	function shake(e, intShakes, intDistance, intDuration) {
		intShakes = intShakes || 2;
		intDistance = intDistance || 25;
		intDuration = intDuration || 200;

		// Non windows.
		if(e.hasOwnProperty("offset")) {
			var left = e.offset().left,
				right = left + e.outerWidth();

			for (var x=1; x<=intShakes; x++) {
				e.animate({left: '-=' + intDistance}, (((intDuration/intShakes)/4)))
				.animate({left: '+=' + intDistance}, ((intDuration/intShakes)/2))
				.animate({left: '+=0'}, (((intDuration/intShakes)/4)));
			}
		}
	}

	// Scan the page on load and turn elements with data tags to buttons.
	function convertDataButtons() {
		var _fields = ["variety", "exchange", "tradingsymbol", "transaction_type", "quantity", "order_type", "price", "trigger_price", "product", "validity", "readonly", "tag", "stoploss", "squareoff", "trailing_stoploss", "disclosed_quantity"];
		var elems = $("*[data-kite]");
		elems.each(function(i, e) {
			e = $(e);

			if(e.data("kite-converted")) {
				return;
			}
			e.data("kite-converted", 1);

			// Get the data attribute params.
			var api_key = e.data("kite"), params = {"variety": "regular"};
			for(var n=0; n<_fields.length; n++) {
				params[_fields[n]] = e.data(_fields[n]);
			}

			if(api_key && params.exchange && params.tradingsymbol && params.quantity && params.transaction_type) {
				ki = new KiteConnect(api_key);
				ki.add(params);
				ki.link(e);

				if(e.prop("tagName").toUpperCase() == "KITE-BUTTON") {
					e.addClass("kite-" + params.transaction_type.toLowerCase());
					e.attr("title", params.transaction_type + " " + params.tradingsymbol);
				}
			}
		});
	}

	// Cross-domain message from the popup dialog.
	function listenForUpdates() {
		$(window).on("message", function(e) {
			e = e.originalEvent;

			// Validate the incoming hostname.
			var a = $("<a>").attr("href", e.origin).get(0);
			if(_hosts.indexOf(a.hostname) == -1 || !e.data) {
				return;
			}

			// Parse the payload.
			try {
				var data = JSON.parse(e.data);
			} catch(e) {
				return;
			}


			if(data.hasOwnProperty("type")) {
				switch(data.type) {
					case "finished":
						setTimeout(function() {
							shake($("#kite-modal"));
						}, 500);
					break;
					case "resize":
						if(data.hasOwnProperty("height") && typeof data.height == "number") {
							var h = data.height,
								wh = $(window).height();
						}
					break;
					case "basket":
						if(data.hasOwnProperty("request_token") && data.hasOwnProperty("status")) {
							if(data.status == "success" || data.status == "cancelled") {
								// Is there an active instance?
								if(active_instance) {
									active_instance.callback(data.status, data.request_token);
									modal_box && modal_box.clear();
								}
							}
						}
					break;
					case "login":
						if(data.hasOwnProperty("request_token") && data.hasOwnProperty("status")) {
							// Is there an active instance?
							if(active_instance) {
								active_instance.callback(data.status, data.request_token);
								modal_box && modal_box.clear();
							}
						}
					break;
					case "holdings.auth":
						if(active_instance) {
							if(active_instance.holauth_callback) {
								active_instance.holauth_callback(data);
							}
							modal_box && modal_box.clear();
						}
					break;
				}
			}
		});
	};


	// The Kite Client class.
	window.KiteConnect = function(api_key) {
		var	basket = [], // individual scrips that will be added
			options = {},
			finished_callback = null,
			id = Math.floor(Math.random()*Math.pow(10,8)); // unique id for this instance


		var me = this;

		// __ Public methods.
		this.login = function() {
			var win = _is_mobile ? modal("", "Kite") : popup("", "Kite", 475);

			// Active instance.
			active_instance = me;

			// Wait text.
			var wait = $("<h2>");
			wait.attr("style", "font-family: 'Segoe UI', 'Helvetica Neue', 'Helvetica', sans; " +
								"text-align: center; margin-top: 60px;" +
								"color: #666;" +
								"font-weight: 200");
			wait.text("Connecting to Kite ...");
			win.append(wait);

			var form = createForm({"api_key": api_key, "view": "popup"}, _root + _uri_login, "get");
			win.append(form);

			(function(f) {
				setTimeout(function() {
					f.submit()
				}, 500);
			})(form);

			return false;
		};

		this.authHoldings = function(req_id, cb) {
			if(cb) {
				this.holauth_callback = cb;
			}
			var win = _is_mobile ? modal("", "Kite") : popup("", "Kite", 600);

			// Active instance.
			active_instance = me;

			// Wait text.
			var wait = $("<h2>");
			wait.attr("style", "font-family: 'Segoe UI', 'Helvetica Neue', 'Helvetica', sans-serif; " +
								"text-align: center; margin-top: 60px;" +
								"color: #666;" +
								"font-weight: 200");
			wait.text("Connecting to Kite ...");
			win.append(wait);

			var form = createForm({}, _root + _uri_holdings_auth + "/" + api_key + "/" + req_id, "get");
			win.append(form);

			(function(f) {
				setTimeout(function() {
					f.submit()
				}, 500);
			})(form);

			return false;
		};

		this.connect = function(id) {
			if(basket.length < 0) {
				return false;
			}

			// Active instance.
			active_instance = me;

			var win = _is_mobile ? modal("", "Kite") : popup("", "Kite");

			// Wait text.
			var wait = $("<h2>");
			wait.attr("style", "font-family: 'Segoe UI', 'Helvetica Neue', 'Helvetica', sans; " +
								"text-align: center; margin-top: 60px;" +
								"color: #666;" +
								"font-weight: 200");
			wait.text("Connecting to Kite ...");
			win.append(wait);

			// Create the form.
			options["view"] = "popup"
			var form = createForm(fields(basket, options), _root + _uri_basket, "post");
			win.append(form);

			(function(f) {
				setTimeout(function() {
					f.submit()
				}, 500);
			})(form);

			return false;
		};

		// Set the 'finished' callback method.
		this.finished = function(callback) {
			finished_callback = callback;
		};
		
		// Set pop-up window close status
		this.winClose = function() {
			win_event = true;
		}
		
		// Set event update for pop-up window close
		this.winEvent = function(win) {
			if (win_event) {
				var timer = setInterval(function() {
					if(win.closed) {
						clearInterval(timer);
						alert('Pop-up window is closed');
					}
				}, 1000);
			}
		};

		// Render trade button.
		this.renderButton = function(target) {
			if(typeof(target) == "string") {
				target = $(target);
			}
			if(!target || typeof(target) != "object") return;

			// Create the link.
			var a = $("<button>").attr("title", "Trade with Kite").
					attr("class", "kite-trade-button");

			// Basket only has one stock?
			if(basket.length == 1) {
				a.addClass("kite-" + basket[0].transaction_type.toLowerCase());
				a.attr("title", basket[0].transaction_type + " " + basket[0].tradingsymbol);
			}

			// Click event.
			a.click(function(e) {
				e.preventDefault();
				$(this).blur();
				me.connect();

				return false;
			});

			$(target).append(a)
		};

		// Link the basket to a given target.
		this.link = function(target) {
			if(typeof(target) == "string") {
				target = $(target);
			}
			if(!target || typeof(target) != "object") return;

			target.click(function(e) {
				e.preventDefault();
				$(this).blur();
				me.connect();

				return false;
			});
		}

		// Add an item to the basket.
		this.add = function(item) {
			if(basket.length >= _max_items) {
				return false;
			}

			for(var n=0; n<arguments.length; n++) {
				var new_item = {},
					item = arguments[n];
				// Clean the fields.
				for(var i=0; i<_fields.length; i++) {
					if(item.hasOwnProperty(_fields[i])) {
						new_item[_fields[i]] = item[_fields[i]];
					}
				}

				if(new_item.transaction_type != "BUY" && new_item.transaction_type != "SELL") {
					new_item.transaction_type = "BUY";
				}

				basket.push(new_item);
			}
		};

		// Set an options.
		this.setOption = function(key, value) {
			if(_options.hasOwnProperty(key)) {
				options[key] = value;
			}
		};

		// Get a copy of all the items in the basket.
		this.get = function() {
			return JSON.parse(JSON.stringify(basket));
		};

		// Number of items added.
		this.count = function() {
			return basket.length;
		};

		// Serialized HTML form of the payload.
		this.html = function() {
			// Create the form.
			var form = createForm(fields(basket, options), _root + _uri_basket, "post");

			return $("<div>").append(form).html();
		}

		// Execute the attached callback.
		this.callback = function(status, request_token) {
			if(typeof(finished_callback) == "function") {
				finished_callback(status ? status : status.cancelled,
								request_token ? request_token : null);
			}
		};

		this.setOption("api_key", api_key);
		this.setOption("redirect_url", "#");
	}

	window.KiteConnect.ready = function(fn) {
		if(loaded) {
			fn();
		} else {
			(function(f) {
				window.setTimeout(function() {
					window.KiteConnect.ready(f);
				}, 50);
			})(fn);
		}
	};


	function initKiteConnect(jq) {
		$ = jq;

		$(document).ready(function() {
			$("body").append( $("<link>").attr("rel", "stylesheet").attr("href", _root + _uri_css) );
			convertDataButtons();

			$(document).bind("DOMNodeInserted", function(e) {
				if($(e.target).data("kite")) {
					convertDataButtons();
				}
			});

			listenForUpdates();
		});

		loaded = true;
	}

	//_________________________________________

	// Check if jQuery is already loaded.
	var load_jq = true;
	if(window.hasOwnProperty("jQuery") && jQuery.hasOwnProperty("fn") && jQuery.fn.hasOwnProperty("jquery")) {
		var v = parseFloat(jQuery.fn.jquery);
		if(!isNaN(v) && v >= 1.6) {
			load_jq = false;
			initKiteConnect(jQuery);
		}
	}

	if(load_jq) {
		// Load jQuery from Google CDN and then init Kite.
		var script = document.createElement("script");
		script.src = "https://ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js";
		var head = document.getElementsByTagName("head")[0],
			done = false;

		// Attach handlers for all browsers.
		script.onload = script.onreadystatechange = function() {
		  if (!done && (!this.readyState
			   || this.readyState == "loaded"
			   || this.readyState == "complete")) {
			done = true;

			initKiteConnect(jQuery);

			script.onload = script.onreadystatechange = null;
			head.removeChild(script);
		  }
		};
		head.appendChild(script);
	}
})();