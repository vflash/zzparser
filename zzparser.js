﻿var EasySax = EasySax || require("easysax");

var zzParser = new function() {
	'use strict';

	var parser = new EasySax();

	var u
	, unids = {}
	, isPermaLink = false
	, context // = 'root'

	, cnxStack // = []
	, unidstack // = []
	, unidnext // = 0

	, text
	, xhtml 
	, item
	, items
	, feed
	;

	var rg_trim = /^[\s|\xA0]+|[\s|\xA0]+$/g
	var trim = ('').trim ? function(s) {return (s+'').trim()} 
		: function(s) {return (s+'').replace(rg_trim, '')}
	; 


	parser.ns('rss', {  // поумолчанию предпологаем что это rss
		'http://www.w3.org/2005/Atom': 'atom',
		'http://www.w3.org/1999/xhtml': 'xhtml',

		'http://search.yahoo.com/mrss/': 'media',
		'http://purl.org/rss/1.0/': 'rss',
		'http://purl.org/dc/elements/1.1/': 'dc',
		'http://www.w3.org/1999/02/22-rdf-syntax-ns#' : 'rdf',
		'http://purl.org/rss/1.0/modules/content/': 'content',
		'http://www.yandex.ru': 'yandex',
		'http://news.yandex.ru': 'yandex',
		'http://backend.userland.com/rss2': 'rss'
		
	});

	parser.on('error', onError);
	parser.on('startNode', onStartNode);
	parser.on('endNode', onEndNode);
	parser.on('textNode', onTextNode);
	parser.on('cdata', onCDATA);

	reset();

	return function feedParser(xml) {
		parser.parse(xml);

		return reset();
	};


	function reset() { // сброс значений
		var _feed = feed;
		text = '';
		xhtml = '';
		items = [];
		item = {};
		feed = {items: items};
		

		unids = {};
		cnxStack = [];
		unidstack = [];
		unidnext = 0;

		context = 'start';

		return _feed;
	};




	function onError(msg) {
		//console.log('errro: ' + msg);
	};

	function onTextNode(x, uq) {
		switch(context) {
			case 'TEXT':
				text += uq(x);
				break;

			case 'XHTML':
				xhtml += x;
				break;
		};
	};

	function onCDATA(x) {
		switch(context) {
			case 'TEXT':
				text += x;
				break;

			case 'XHTML':
				xhtml += '<![CDATA[' + x + ']]>';
				break;
		};
	};

	function onStartNode(elem, attr, uq, tagend, get_str){
		var u, unid = unidnext++, v;
		//var attrs = attr();  // --all

		unidstack.push(unid);
		cnxStack.push(context);

		switch(context) {

			case 'TEXT': case null:
				return;

			case 'XHTML':
				if (elem === 'xhtml:script') {
					context = null;
					return;
				};

				xhtml += get_str();
				return;

			case 'start':
				if (elem === 'atom:feed' || elem === 'rss:rss' || elem === 'rdf:RDF') {
					feed.type = elem === 'atom:feed' ? 'atom' : 'rss';

					unids.root = unid;
					context = 'root';
				};

				return;

			case 'root':
				if (elem === 'rss:channel') {
					return;
				};

				if (elem === 'atom:entry' || elem === 'rss:item') {
					unids.item = unid;
					context = 'item';

					isPermaLink = false;
					return;
				};

				if (elem === 'atom:title' || elem === 'rss:title') {
					unids.rootTitle = unid;
					context = 'TEXT';
					return;
				};

				if (elem === 'rss:link') {
					unids.rootLink = unid;
					context = 'TEXT';
					return;
				};

				if (elem === 'atom:link' && attr().type == 'text/html') {
					v = attr();
					if (v.type === 'text/html' || (!v.type && !feed.link) ) {
						feed.link = trim(v.href);
					};

					context = null;
					return;
				};

				break;

			case 'item':
				if (elem === 'atom:title' || elem === 'rss:title') {
					unids.itemTitle = unid;
					context = 'TEXT';
					return;
				};


				if (elem === 'rss:link') {
					unids.itemLink = unid;
					context = 'TEXT';
					return;
				};

				if (elem === 'atom:link') {
					v = attr();
					if (v.type === 'text/html' || (!v.type && !item.link)) {
						item.link = trim(v.href);
					};

					context = null;
					return;
				};


				if (elem === 'atom:content' && attr().type == 'xhtml') {
					unids.itemDescriptionXHTML = unid;
					context = 'XHTML';	
					return;
				};


				if (elem === 'rss:description' || (elem === 'atom:content' || elem === 'atom:summary') && (attr().type === 'html' || attr().type === 'text/html') ) {
					context = 'TEXT';	
					unids.itemDescription = unid;
					return
				};

				if (elem === 'content:encoded') { 
					unids.itemContentEncoded = unid;
					context = 'TEXT';
					return;
				};

				if (elem === 'yandex:full-text') {  // yandex бля
					unids.itemYandexFullText = unid;
					context = 'TEXT';
					return;
				};
				

				if (elem === 'atom:summary') {
					if (attr().type === 'text' || !attr().type) {
						unids.itemSummaryText = unid;
						context = 'TEXT';	
					} else {
						context = null;	
					};

					return;
				};


				if (elem === 'atom:published') {
					unids.itemPublished = unid;
					context = 'TEXT';
					return;
				};

				if (elem === 'rss:pubDate' || elem === 'rss:pubdate' || elem === 'dc:date') {
					unids.itemPublished = unid;
					context = 'TEXT';
					return;
				};

				if (elem === 'atom:id') {
					unids.itemID = unid;
					context = 'TEXT';
					return;
				};

				if (elem === 'rss:guid') {
					unids.itemID = unid;
					context = 'TEXT';

					isPermaLink = attr().isPermaLink !== 'false';
					return;
				};

				if (elem === 'rss:enclosure' || elem === 'media:content') {
					context = null;

					var v = attr();
					if (!v.url) return;

					switch(v.type) {
						case 'image/jpeg': case 'image/png': case 'image/gif': 
							if (!item.imgs) item.imgs = [];

							item.imgs.push({src: v.url
								, size: +v.length || u
								, width: +v.width || u
								, height: +v.height || u
							});

							break;
						
						case 'audio/mpeg':
							if (!item.audio) item.audio = [];
							item.audio.push({src: v.url, type: v.type, size: +v.length || u});
							break;
					};

					return
				};

				break;
		};
		

		context = null;
	};

	function html_entities(a) {
		return a === '&' ? '&quot;' : a === '<' ? '&lt;' : '&gt;';
	};

	function onEndNode(elem, uq, tagstart, get_str){

		var unid = unidstack.pop(unid), x;
		context = cnxStack.pop(context);

		/*
		if (context === null || context === 'TEXT') {
			return;
		};
		*/

		if (context === 'XHTML') {
			if (!tagstart) xhtml += get_str();
			return;
		};

		switch(unid) {
			case null: break;

			case unids.root:
				break;

			case unids.rootTitle:
				feed.title = trim(text);
				text = '';
				break;

			case unids.rootLink:
				feed.link = String(text).trim();
				text = '';
				break;

			case unids.item:
				if (!item.link && isPermaLink && item.guid) {
					item.link = item.guid;
				};

				if (item.guid) {
					feed.streamed = true;
				};

				if (!item.desc && item.content) {
					item.desc = item.content;
					delete(item.content);
				};

				items.push(item);
				item = {};
				break;

			case unids.itemLink:
				item.link = trim(text);
				text = '';
				break;

			case unids.itemTitle:
				item.title = trim(text);
				text = '';
				break;


			case unids.itemDescriptionXHTML:
				item.desc = trim(xhtml);
				xhtml = '';
				break;


			
			case unids.itemDescription:
				//item.desc = text.substring(0, 70);
				item.desc = trim(text);
				text = '';
				break;

			case unids.itemSummaryText:
				if (!item.desc) {
					item.desc = trim(text).replace(/[&<>]/g, html_entities);
				};

				text = '';
				break;

			case unids.itemContentEncoded:
				item.content = trim(text);
				text = '';
				break;

			case unids.itemYandexFullText: // yandex бля
				if (!item.content) {
					//item.content = '<p>' + trim(text).replace(/([\f\t\v]*\r?\n){2,}[\f\t\v]*/g, '</p></p>').replace(/([\f\t\v]*\r?\n)+[\f\t\v]*/g, '<br/>') + '</p>';
					//item.content = '<div class="zzYandexFullText" style="white-space:pre-wrap;">' + text.replace(/^([\f\t\v\r ]*\n)*|\s*$/g, '') + '</div>';
					item.content = '<div class="zzYandexFullText" style="white-space:pre-wrap;">' + text.replace(/^([\f\t\v\r ]*\n)*/, '').replace(/\s*$/, '') + '</div>';
				};
				text = '';
				break;

			case unids.itemPublished:
				if (item.utime == null) {
					x = +new Date(text)/1000;
					item.utime = x != x ? null : Math.floor(x);
				};

				text = '';
				break;

			case unids.itemID:
				item.guid = trim(text);
				text = '';
				break;
		};
	};
};


// ------------------------------------------------------

if (typeof exports === 'object' && this == exports) {
	module.exports = zzParser;
};
