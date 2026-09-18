import Badge, { badgeClasses } from '@mui/material/Badge';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';

export interface MenuButtonProps extends IconButtonProps {
    showBadge?: boolean;
    badgeContent?: number;
}

export default function MenuButton({
    showBadge = false,
    badgeContent,
    ...props
}: MenuButtonProps) {
    const numeric = badgeContent !== undefined;
    return (
        <Badge
            color="error"
            variant={numeric ? 'standard' : 'dot'}
            badgeContent={numeric ? badgeContent : undefined}
            max={99}
            invisible={numeric ? badgeContent === 0 : !showBadge}
            sx={{ [`& .${badgeClasses.badge}`]: { right: 2, top: 2 } }}
        >
            <IconButton size="small" {...props} />
        </Badge>
    );
}