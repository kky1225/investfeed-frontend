import WidthNormalIcon from '@mui/icons-material/WidthNormalRounded';
import IconButton, {IconButtonOwnProps} from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import {Fragment, MouseEvent, useState} from "react";
import {loadPageWidth, PAGE_WIDTH_LABELS, PAGE_WIDTHS, PageWidth, savePageWidth} from "../lib/pageWidth.ts";

/** 머리줄의 화면 폭 선택: 화면 내용의 최대 너비를 기본·넓게·전체 중에서 고른다. 밝기 선택과 같은 모양이다. */
export default function PageWidthSelect(props: IconButtonOwnProps) {
    const [width, setWidth] = useState<PageWidth>(loadPageWidth);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleClick = (event: MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };
    const handleWidth = (target: PageWidth) => () => {
        setWidth(target);
        savePageWidth(target);
        handleClose();
    };
    return (
        <Fragment>
            <Tooltip title="화면 폭">
                <IconButton
                    onClick={handleClick}
                    disableRipple
                    size="small"
                    aria-label="화면 폭"
                    aria-controls={open ? 'page-width-menu' : undefined}
                    aria-haspopup="true"
                    aria-expanded={open ? 'true' : undefined}
                    {...props}
                >
                    <WidthNormalIcon/>
                </IconButton>
            </Tooltip>
            <Menu
                anchorEl={anchorEl}
                id="page-width-menu"
                open={open}
                onClose={handleClose}
                slotProps={{
                    paper: {
                        variant: 'outlined',
                        elevation: 0,
                        sx: {
                            my: '4px',
                        },
                    },
                }}
                transformOrigin={{horizontal: 'right', vertical: 'top'}}
                anchorOrigin={{horizontal: 'right', vertical: 'bottom'}}
            >
                {PAGE_WIDTHS.map(option => (
                    <MenuItem key={option} selected={width === option} onClick={handleWidth(option)}>
                        {PAGE_WIDTH_LABELS[option]}
                    </MenuItem>
                ))}
            </Menu>
        </Fragment>
    );
}
