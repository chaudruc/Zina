<?php
# you can override default theme functions by including them here

function sockCrystal_page_complete($zina) {
	$theme_path = $zina['theme_path'];

	$output = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">'.
		'<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en"><head><title>'.$zina['title'].'</title>'.
		'<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />'.
		'<link rel="shortcut icon" href="'.$theme_path.'/zina.ico" type="image/x-icon" />'.
		'<link rel="stylesheet" href="'.$theme_path.'/index.css" type="text/css" />'.
		$zina['head_css'].$zina['head_js'].'</head><body><div id="zina" class="clear-block">';

	$output .= '<div class="header">'.
		'<div class="header-left"><h1>'.$zina['title'].'</h1>';

		if (isset($zina['dir_year']) || isset($zina['dir_genre'])) {
			$output .= '<div class="title-details">';
			if (isset($zina['dir_genre'])) $output .= $zina['dir_genre'];
			if (!empty($zina['dir_year'])) $output .= ' ('.$zina['dir_year'].')';
			$output .= '</div>';
		}
	$output .= '</div><div class="header-right">';
	$output .= $zina['searchform'];

	if (isset($zina['admin_config'])) {
		$output .= zl(ztheme('icon','config.gif',zt('Settings')),$zina['admin_config']['path'],$zina['admin_config']['query']);
	}
	$lang['login'] = zt('Login');
	$lang['logout'] = zt('Logout');
	if (isset($zina['login'])) {
		$output .= zl(ztheme('icon',$zina['login']['type'].'.gif',$lang[$zina['login']['type']]), $zina['login']['path'], $zina['login']['query']);
	}

	$output .= '</div></div>';

	$output .= '<div class="breadcrumb"><div class="breadcrumb-left">'.ztheme('breadcrumb',$zina['breadcrumb']).'</div>'.
		'<div class="breadcrumb-right">'.$zina['randomplayform'].'</div></div>';

	if (!empty($zina['zinamp']) && (!isset($zina['page_main']) || isset($zina['category']))) {
		$output .= '<div style="text-align:right;">'.$zina['zinamp'].'</div>';		
	}

	if (!isset($zina['popup'])) { }
	$output .= '<div class="content clear-block">'.
		'<div id="zina_messages">'.$zina['messages'].'</div>'.
		$zina['content'].
		ztheme('page_footer',$zina).
		'</div></div></body></html>';

	return $output;
}
?>
